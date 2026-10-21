import { z } from 'zod';

/** Jira-shaped `provider_config` on `project_management_connections`. */
export const jiraProviderConfigSchema = z.object({
  site_url: z.string().min(1),
  account_email: z.string().nullable().optional(),
});

export type JiraProviderConfig = z.infer<typeof jiraProviderConfigSchema>;

export function buildJiraProviderConfig(input: {
  site_url: string;
  account_email?: string | null;
}): JiraProviderConfig {
  return jiraProviderConfigSchema.parse({
    site_url: input.site_url,
    account_email: input.account_email ?? null,
  });
}

/** Parse stored JSON; throws ZodError on invalid shape. */
export function parseJiraProviderConfig(value: unknown): JiraProviderConfig {
  return jiraProviderConfigSchema.parse(value ?? {});
}

/** Safe parse for reads that should not fail the whole list. */
export function tryParseJiraProviderConfig(
  value: unknown
): JiraProviderConfig | null {
  const result = jiraProviderConfigSchema.safeParse(value ?? {});
  return result.success ? result.data : null;
}
