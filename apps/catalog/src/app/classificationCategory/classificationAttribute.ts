import { Type, type Static } from '@sinclair/typebox';

// Attributes that can be used as nested types
export const ClassificationAttributeBaseType: Record<string, string> = {
  NUMBER: 'number',
  TEXT: 'text',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  ENUM: 'enum',
  OBJECT: 'object',
  REFERENCE: 'reference'
}

// Other attribute types
export const ClassificationAttributeComplexType: Record<string, string> = {
    LIST: 'list'
}

// All attribute types
export const ClassificationAttributeType = {
  ...ClassificationAttributeBaseType,
  ...ClassificationAttributeComplexType
};

const keyAttributes = { minLength: 2, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' };

// COMMON PROPERTIES
export const ClassificationAttributeCommonSchema = Type.Object({
  key: Type.String(keyAttributes),
  label: Type.String(),
  isRequired: Type.Boolean()
});

// NUMBER PROPERTIES
export const ClassificationAttributeBaseNumberSchema = Type.Composite(
  [
    ClassificationAttributeCommonSchema,
    Type.Object({
      type: Type.Literal(ClassificationAttributeType.NUMBER),
      min: Type.Optional(Type.Integer()),
      max: Type.Optional(Type.Integer())
    })
  ],
  { additionalProperties: false }
);

// STRING PROPERTIES
export const ClassificationAttributeBaseStringSchema = Type.Composite(
  [
    ClassificationAttributeCommonSchema,
    Type.Object({
      type: Type.Literal(ClassificationAttributeType.TEXT),
      minLength: Type.Optional(Type.Integer()),
      maxLength: Type.Optional(Type.Integer())
    })
  ],
  { additionalProperties: false }
);

// DATETIME PROPERTIES
export const ClassificationAttributeBaseDateTimeSchema = Type.Composite(
  [
    ClassificationAttributeCommonSchema,
    Type.Object({
      type: Type.Literal(ClassificationAttributeType.DATETIME)
    })
  ],
  { additionalProperties: false }
);

// ENUM PROPERTIES
export const ClassificationAttributeBaseEnumSchema = Type.Composite(
  [
    ClassificationAttributeCommonSchema,
    Type.Object({
      type: Type.Literal(ClassificationAttributeType.ENUM),
      options: Type.Array(Type.Object({ key: Type.String(keyAttributes), label: Type.String() }), {
        minItems: 2
      })
    })
  ],
  { additionalProperties: false }
);

// OBJECT PROPERTIES
export const ClassificationAttributeBaseObjectSchema = Type.Composite(
  [
    ClassificationAttributeCommonSchema,
    Type.Object({
      type: Type.Literal(ClassificationAttributeType.OBJECT),
      ref: Type.String()
    })
  ],
  { additionalProperties: false }
);

// LIST PROPERTIES
export const ClassificationAttributeBaseListSchema = Type.Composite(
  [
    ClassificationAttributeCommonSchema,
    Type.Object({
      type: Type.Literal(ClassificationAttributeType.LIST),
      elementType: Type.Enum(ClassificationAttributeBaseType)
    })
  ],
  { additionalProperties: false }
);

// ATTRIBUTE ENTITY
export const ClassificationAttributeSchema = Type.Union([
  ClassificationAttributeBaseNumberSchema,
  ClassificationAttributeBaseStringSchema,
  ClassificationAttributeBaseDateTimeSchema,
  ClassificationAttributeBaseEnumSchema,
  ClassificationAttributeBaseObjectSchema,
  ClassificationAttributeBaseListSchema
]);
export type ClassificationAttribute = Static<typeof ClassificationAttributeSchema>;
