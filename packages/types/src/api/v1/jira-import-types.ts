import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';

export enum JiraImportActionEnum {
  Map = 'map',
  Ignore = 'ignore',
  Drop = 'drop',
}

export const jiraImportActionSchema = z.enum([
  JiraImportActionEnum.Map,
  JiraImportActionEnum.Ignore,
  JiraImportActionEnum.Drop,
]);
export type JiraImportAction = z.infer<typeof jiraImportActionSchema>;

export const jiraImportTypeBehaviorSchema = z.object({
  action: jiraImportActionSchema,
  targetType: z.enum(Constants.public.Enums.WorkItemType).optional(),
});
export type JiraImportTypeBehavior = z.infer<
  typeof jiraImportTypeBehaviorSchema
>;

export const jiraImportConfigSchema = z.object({
  typeMappings: z
    .record(z.string(), jiraImportTypeBehaviorSchema)
    .default({}),
  hierarchy: z.array(z.enum(Constants.public.Enums.WorkItemType)).optional(),
});
export type JiraImportConfig = z.infer<typeof jiraImportConfigSchema>;
