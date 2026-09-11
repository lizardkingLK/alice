import { z } from 'zod';

export enum DynamicFieldTypeEnum {
  STRING = 'string',
  NUMBER = 'number',
  INTEGER = 'integer',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
}

export enum TemplateFieldCategoryEnum {
  AGILE_PRIORITIZATION = 'Agile Prioritization',
  REQUIREMENTS_QA = 'Requirements & QA',
  STRATEGY_VALUE = 'Strategy & Value',
  RELEASE_MANAGEMENT = 'Release Management',
  SECURITY_GOVERNANCE = 'Security & Governance',
  DEFECTS_QA = 'Defects & QA',
  DEVOPS_DEPLOYMENT = 'DevOps & Deployment',
}

export enum TemplateFieldKeyEnum {
  MOSCOW_RATING = 'moscowRating',
  ACCEPTANCE_CRITERIA = 'acceptanceCriteria',
  BUSINESS_VALUE = 'businessValue',
  RELEASE_NOTES_INCLUDED = 'releaseNotesIncluded',
  SECURITY_CLASSIFICATION = 'securityClassification',
  COMPLIANCE_TIER = 'complianceTier',
  SEVERITY = 'severity',
  ENVIRONMENT = 'environment',
}

export enum DynamicFieldConfirmationModeEnum {
  WARNING = 'warning',
  ERROR = 'error',
  INFO = 'info',
}

export const DYNAMIC_FIELD_TYPES = [
  DynamicFieldTypeEnum.STRING,
  DynamicFieldTypeEnum.NUMBER,
  DynamicFieldTypeEnum.INTEGER,
  DynamicFieldTypeEnum.BOOLEAN,
  DynamicFieldTypeEnum.ARRAY,
] as const;

export const DynamicFieldPropertySchema = z.object({
  type: z.enum([
    DynamicFieldTypeEnum.STRING,
    DynamicFieldTypeEnum.NUMBER,
    DynamicFieldTypeEnum.INTEGER,
    DynamicFieldTypeEnum.BOOLEAN,
    DynamicFieldTypeEnum.ARRAY,
  ]),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  enum: z
    .array(z.string().min(1, 'Enum options cannot be empty'))
    .min(1, 'Enum must contain at least one option')
    .optional(),
  items: z
    .object({
      type: z.enum([
        DynamicFieldTypeEnum.STRING,
        DynamicFieldTypeEnum.NUMBER,
        DynamicFieldTypeEnum.INTEGER,
        DynamicFieldTypeEnum.BOOLEAN,
      ]),
      enum: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  format: z.string().optional(),
  default: z.unknown().optional(),
  'x-component': z.string().optional(),
});

export const ProjectFieldsConfigSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal('object'),
  title: z.string().optional(),
  description: z.string().optional(),
  properties: z.record(
    z.string().regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        'Field identifier must only contain letters, numbers, hyphens, and underscores',
    }),
    DynamicFieldPropertySchema
  ),
  additionalProperties: z.boolean().optional().default(true),
});

export type DynamicFieldProperty = z.infer<typeof DynamicFieldPropertySchema>;
export type ProjectFieldsConfig = z.infer<typeof ProjectFieldsConfigSchema>;
