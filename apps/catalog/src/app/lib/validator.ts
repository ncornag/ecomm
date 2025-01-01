import { type Result, Ok, Err } from 'ts-results-es';
import { Ajv } from 'ajv';
import { AppError, ErrorCode } from '@ecomm/app-error';
import {
  type ClassificationAttribute,
  ClassificationAttributeType
} from '../classificationCategory/classificationAttribute.ts';
import { Type } from '@sinclair/typebox';
import { type IProductCategoryRepository } from '../productCategory/productCategory.repo.ts';
import { type IClassificationCategoryRepository } from '../classificationCategory/classificationCategory.repo.ts';

export class Validator {
  private server: any;
  private validator;
  private classificationCategoryRepository: IClassificationCategoryRepository;
  private productCategoryRepository: IProductCategoryRepository;

  private cache: Map<string, any> = new Map<string, any>();

  constructor(server: any) {
    this.server = server;
    this.productCategoryRepository = server.db.repo.productCategoryRepository;
    this.classificationCategoryRepository = server.db.repo.classificationCategoryRepository;
    this.valueidator = new Ajv({
      coerceTypes: 'array',
      useDefaults: true,
      addUsedSchema: false
    });
  }

  // Generate a JSON Schema based on a list of attributes
  async generateSchema(attributes: any): Promise<Result<any, AppError>> {
    const properties = await attributes.reduce(async (accP: any, curr: any) => {
      const acc = await accP;
      let t: any;
      const opts: any = {};
      switch (curr.type) {
        case ClassificationAttributeType.NUMBER: {
          if (curr.min) opts.minimum = curr.min;
          if (curr.max) opts.maximum = curr.max;
          t = Type.Number(opts);
          break;
        }
        case ClassificationAttributeType.TEXT: {
          if (curr.minLength) opts.minLength = curr.minLength;
          if (curr.maxLength) opts.maxLength = curr.maxLength;
          t = Type.String();
          break;
        }
        case ClassificationAttributeType.STRING: {
          t = Type.String();
          break;
        }
        case ClassificationAttributeType.DATETIME: {
          // TODO review date-time format
          t = Type.Date();
          break;
        }
        case ClassificationAttributeType.BOOLEAN: {
          t = Type.Boolean();
          break;
        }
        case ClassificationAttributeType.ENUM: {
          const options: any = curr.options.map((o: any) => Type.Literal(o.key));
          t = Type.Union(options);
          break;
        }
        case ClassificationAttributeType.OBJECT: {
          const result: Result<any, AppError> = await this.getClassificationCategorySchema(curr.ref);
          if (result.isErr()) return result;
          t = result.value.z;
          break;
        }
        case ClassificationAttributeType.LIST: {
          let elementType;
          switch (curr.elementType) {
            case 'number':
              elementType = Type.Number();
              break;
            case 'text':
              elementType = Type.String();
              break;
            default:
              // TODO: Throw error...
              console.log('Invalid elementType for ', curr.name);
              break;
          }
          t = Type.Array(elementType!);
          break;
        }
        default:
          // TODO: Throw error, like
          //return Err(new AppError(ErrorCode.BAD_REQUEST, `Incorrect attribute type for [${a.name}]`));
          console.log('Invalid type ' + curr.type + ' for ', curr.name);
          break;
      }
      if (!curr.isRequired) t = Type.Optional(t);
      acc[curr.key] = t;
      return await acc;
    }, Promise.resolve({}));
    return Ok(Type.Object(properties, { additionalProperties: false }));
  }

  // Get the attributes of a Product Category (ancestors' attributes are included))
  async getProductCategorySchema(id: string): Promise<Result<any, AppError>> {
    let schema = this.cache.get(id);
    if (!schema) {
      let cCategories: string[] = [];
      let attributes: ClassificationAttribute[] = [];

      // Get the Category with Classifications + the ancestors with Classifications
      const resultCatCC = await this.productCategoryRepository.aggregate([
        { $match: { _id: id } },
        {
          $lookup: {
            from: 'ProductCategory',
            localField: 'ancestors',
            foreignField: '_id',
            as: 'ancestors'
          }
        },
        { $unwind: '$ancestors' },
        { $unwind: '$ancestors.classificationCategories' },
        {
          $project: {
            _id: 0,
            classificationCategories: 1,
            ancestors: '$ancestors.classificationCategories'
          }
        }
      ]);
      if (resultCatCC.isErr()) return resultCatCC;
      const catCC = resultCatCC.value;
      if (catCC.length < 1) return Err(new AppError(ErrorCode.NOT_FOUND, `Entity [${id}] not found`));
      cCategories = cCategories.concat(catCC[0]?.classificationCategories || []);
      cCategories = cCategories.concat(
        catCC.reduce((flattenedArray: any, element: any) => [...flattenedArray, element.ancestors], [])
      );

      // Get the Classification's Attributes
      const resultCC = await this.classificationCategoryRepository.aggregate([
        { $match: { _id: { $in: cCategories } } },
        {
          $lookup: {
            from: 'ClassificationCategory',
            localField: 'ancestors',
            foreignField: '_id',
            as: 'ancestors'
          }
        },
        { $unwind: '$ancestors' },
        {
          $project: {
            _id: 1,
            attributes: 1,
            ancestors: '$ancestors.attributes'
          }
        }
      ]);
      if (resultCC.isErr()) return resultCC;
      const cc = resultCC.value;
      attributes = attributes.concat(
        cc.reduce((flattenedArray: any, element: any) => [...flattenedArray, element.attributes], [])
      );
      attributes = attributes
        .concat(cc.reduce((flattenedArray: any, element: any) => [...flattenedArray, element.ancestors], []))
        .flat();

      const result = await this.generateSchema(attributes);
      if (result.isErr()) return result;
      schema = { jsonSchema: result.value, z: result.value };
      if (this.server.config.CACHE_JSON_SCHEMAS) this.cache.set(id, schema);
    }
    return Ok(schema);
  }

  // CLASSIFICATION CATEGORY
  async getClassificationCategorySchema(id: string): Promise<Result<any, AppError>> {
    let schema = this.cache.get(id);
    if (!schema) {
      console.log('Generating schema for ' + id);
      const result = await this.classificationCategoryRepository.aggregate([
        { $match: { _id: id } },
        {
          $lookup: {
            from: 'ClassificationCategory',
            localField: 'ancestors',
            foreignField: '_id',
            as: 'ancestors'
          }
        },
        {
          $project: {
            _id: 1,
            attributes: 1,
            ancestors: '$ancestors.attributes'
          }
        }
      ]);
      const entity = (result.value as any)[0];
      const attributes = entity.attributes.concat(entity.ancestors).flat();
      const schemaResult = await this.generateSchema(attributes);
      if (schemaResult.isErr()) return schemaResult;
      schema = { jsonSchema: schemaResult.value, z: schemaResult.value };
      if (this.server.config.CACHE_JSON_SCHEMAS) this.cache.set(id, schema);
    }
    return Ok(schema);
  }

  validate(schema: any, data: any): Result<any, AppError> {
    const validateFn = this.valueidator.compile(schema);
    const valid = validateFn(data);
    if (!valid) {
      return Err(
        new AppError(
          ErrorCode.BAD_REQUEST,
          `${validateFn.errors![0].instancePath || '/'} ${validateFn.errors![0].message} ${
            validateFn.errors![0].params.additionalProperty || ''
          }`
        )
      );
    }
    return Ok(true);
  }
}
