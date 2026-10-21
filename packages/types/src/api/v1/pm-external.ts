import { z } from 'zod';

const vendorJira = z.literal('jira');

/** `projects.pm_external` when linked to Jira. */
export const projectPmExternalSchema = z.object({
  vendor: vendorJira,
  project_key: z.string().min(1),
});

export type ProjectPmExternal = z.infer<typeof projectPmExternalSchema>;

/** `work_items.pm_external` when imported from Jira. */
export const workItemPmExternalSchema = z.object({
  vendor: vendorJira,
  issue_key: z.string().min(1),
});

export type WorkItemPmExternal = z.infer<typeof workItemPmExternalSchema>;

export function buildJiraProjectPmExternal(
  projectKey: string
): ProjectPmExternal {
  return projectPmExternalSchema.parse({
    vendor: 'jira',
    project_key: projectKey,
  });
}

export function buildJiraWorkItemPmExternal(
  issueKey: string
): WorkItemPmExternal {
  return workItemPmExternalSchema.parse({
    vendor: 'jira',
    issue_key: issueKey,
  });
}

export function tryParseProjectPmExternal(
  value: unknown
): ProjectPmExternal | null {
  const result = projectPmExternalSchema.safeParse(value ?? {});
  return result.success ? result.data : null;
}

export function tryParseWorkItemPmExternal(
  value: unknown
): WorkItemPmExternal | null {
  const result = workItemPmExternalSchema.safeParse(value ?? {});
  return result.success ? result.data : null;
}

export function jiraProjectKeyFromPmExternal(value: unknown): string | null {
  return tryParseProjectPmExternal(value)?.project_key ?? null;
}

export function jiraIssueKeyFromPmExternal(value: unknown): string | null {
  return tryParseWorkItemPmExternal(value)?.issue_key ?? null;
}

/** Map API/DTO `jira_project_key` into a persistable `pm_external` value. */
export function projectPmExternalFromJiraKey(
  jiraProjectKey: string | null | undefined
): ProjectPmExternal | null {
  if (jiraProjectKey == null || jiraProjectKey.trim() === '') {
    return null;
  }
  return buildJiraProjectPmExternal(jiraProjectKey.trim());
}

/** Map API/DTO `jira_issue_key` into a persistable `pm_external` value. */
export function workItemPmExternalFromJiraKey(
  jiraIssueKey: string | null | undefined
): WorkItemPmExternal | null {
  if (jiraIssueKey == null || jiraIssueKey.trim() === '') {
    return null;
  }
  return buildJiraWorkItemPmExternal(jiraIssueKey.trim());
}

/** Project row → wire DTO still exposing `jira_*` field names. */
export function withJiraProjectDtoFields<
  T extends {
    pm_connection_id?: string | null;
    pm_external?: unknown;
  },
>(
  row: T
): T & {
  jira_connection_id: string | null;
  jira_project_key: string | null;
} {
  return {
    ...row,
    jira_connection_id: row.pm_connection_id ?? null,
    jira_project_key: jiraProjectKeyFromPmExternal(row.pm_external),
  };
}

/** Work item row → wire DTO still exposing `jira_issue_key`. */
export function withJiraIssueKeyDtoField<
  T extends {
    pm_external?: unknown;
  },
>(row: T): T & { jira_issue_key: string | null } {
  return {
    ...row,
    jira_issue_key: jiraIssueKeyFromPmExternal(row.pm_external),
  };
}
