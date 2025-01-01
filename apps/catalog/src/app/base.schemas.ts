import { type Static, Type } from '@sinclair/typebox';

// PROJECT BASED PARAMS
export const ProjectBasedParamsSchema = Type.Object({
  projectId: Type.String()
});
export type ProjectBasedParams = Static<typeof ProjectBasedParamsSchema>;
