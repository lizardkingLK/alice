import {
  DynamicFieldFormatEnum,
  DynamicFieldTypeEnum,
  TemplateFieldCategoryEnum,
  TemplateFieldKeyEnum,
} from '@repo/types';

export interface TemplateFieldItem {
  key: string;
  category: string;
  property: {
    type: string;
    title: string;
    description: string;
    enum?: string[];
    format?: string;
    minimum?: number;
    maximum?: number;
    default?: unknown;
  };
}

export const TEMPLATE_FIELD_OPTIONS: TemplateFieldItem[] = [
  {
    key: TemplateFieldKeyEnum.MOSCOW_RATING,
    category: TemplateFieldCategoryEnum.AGILE_PRIORITIZATION,
    property: {
      type: DynamicFieldTypeEnum.STRING,
      title: 'MoSCoW Rating',
      description: 'Agile MoSCoW prioritization category',
      enum: ['Must', 'Should', 'Could', "Won't"],
    },
  },
  {
    key: TemplateFieldKeyEnum.ACCEPTANCE_CRITERIA,
    category: TemplateFieldCategoryEnum.REQUIREMENTS_QA,
    property: {
      type: DynamicFieldTypeEnum.STRING,
      title: 'Acceptance Criteria',
      description:
        'Conditions that must be met for this work item to be accepted',
      format: DynamicFieldFormatEnum.MULTILINE,
    },
  },
  {
    key: TemplateFieldKeyEnum.BUSINESS_VALUE,
    category: TemplateFieldCategoryEnum.STRATEGY_VALUE,
    property: {
      type: DynamicFieldTypeEnum.NUMBER,
      title: 'Business Value',
      description: 'Relative business value score (1-100)',
      minimum: 1,
      maximum: 100,
    },
  },
  {
    key: TemplateFieldKeyEnum.RELEASE_NOTES_INCLUDED,
    category: TemplateFieldCategoryEnum.RELEASE_MANAGEMENT,
    property: {
      type: DynamicFieldTypeEnum.BOOLEAN,
      title: 'Include in Release Notes',
      description:
        'Whether this item should be highlighted in customer release notes',
      default: false,
    },
  },
  {
    key: TemplateFieldKeyEnum.SECURITY_CLASSIFICATION,
    category: TemplateFieldCategoryEnum.SECURITY_GOVERNANCE,
    property: {
      type: DynamicFieldTypeEnum.STRING,
      title: 'Security Classification',
      description:
        'Confidentiality and sensitivity level of this work item',
      enum: ['Public', 'Internal', 'Confidential', 'Restricted'],
    },
  },
  {
    key: TemplateFieldKeyEnum.COMPLIANCE_TIER,
    category: TemplateFieldCategoryEnum.SECURITY_GOVERNANCE,
    property: {
      type: DynamicFieldTypeEnum.STRING,
      title: 'Compliance Tier',
      description: 'Applicable regulatory compliance and audit tier',
      enum: ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    },
  },
  {
    key: TemplateFieldKeyEnum.SEVERITY,
    category: TemplateFieldCategoryEnum.DEFECTS_QA,
    property: {
      type: DynamicFieldTypeEnum.STRING,
      title: 'Defect Severity',
      description:
        'Severity assessment for bug tracking and resolution priority',
      enum: ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'],
    },
  },
  {
    key: TemplateFieldKeyEnum.ENVIRONMENT,
    category: TemplateFieldCategoryEnum.DEVOPS_DEPLOYMENT,
    property: {
      type: DynamicFieldTypeEnum.STRING,
      title: 'Target Environment',
      description:
        'Target deployment or testing environment',
      enum: ['Development', 'Staging', 'UAT', 'Production'],
    },
  },
];

export const DEFAULT_STARTER_KEYS: string[] = [
  TemplateFieldKeyEnum.MOSCOW_RATING,
  TemplateFieldKeyEnum.ACCEPTANCE_CRITERIA,
  TemplateFieldKeyEnum.BUSINESS_VALUE,
  TemplateFieldKeyEnum.RELEASE_NOTES_INCLUDED,
];
