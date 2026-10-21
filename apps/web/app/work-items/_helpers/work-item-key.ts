import { jiraIssueKeyFromPmExternal } from '@repo/types';

/** Short display key: Jira key when present, else truncated id. */
export function formatWorkItemKey(workItem: {
  readonly id: string;
  readonly jira_issue_key?: string | null;
  readonly pm_external?: unknown;
}): string {
  return (
    workItem.jira_issue_key?.trim() ||
    jiraIssueKeyFromPmExternal(workItem.pm_external)?.trim() ||
    workItem.id.slice(0, 8).toUpperCase()
  );
}
