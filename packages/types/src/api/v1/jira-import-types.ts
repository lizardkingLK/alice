import { z } from 'zod';

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

/** Target is a project catalog type key (arbitrary string). */
const projectTypeKeySchema = z.string().trim().min(1);

export const jiraImportTypeBehaviorSchema = z.object({
  action: jiraImportActionSchema,
  targetType: projectTypeKeySchema.optional(),
});
export type JiraImportTypeBehavior = z.infer<
  typeof jiraImportTypeBehaviorSchema
>;

export const jiraImportConfigSchema = z.object({
  typeMappings: z.record(z.string(), jiraImportTypeBehaviorSchema).default({}),
  /** Ordered catalog keys (levels = index). */
  hierarchy: z.array(projectTypeKeySchema).optional(),
});
export type JiraImportConfig = z.infer<typeof jiraImportConfigSchema>;
