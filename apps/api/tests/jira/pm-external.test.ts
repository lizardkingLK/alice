import { describe, it, expect } from 'vitest';
import {
  buildJiraProjectPmExternal,
  buildJiraWorkItemPmExternal,
  jiraIssueKeyFromPmExternal,
  jiraProjectKeyFromPmExternal,
  projectPmExternalFromJiraKey,
  workItemPmExternalFromJiraKey,
  withJiraIssueKeyDtoField,
  withJiraProjectDtoFields,
} from '@repo/types';

describe('pm_external helpers', () => {
  it('builds and parses project pm_external', () => {
    const built = buildJiraProjectPmExternal('ABC');
    expect(built).toEqual({ vendor: 'jira', project_key: 'ABC' });
    expect(jiraProjectKeyFromPmExternal(built)).toBe('ABC');
    expect(projectPmExternalFromJiraKey(null)).toBeNull();
    expect(projectPmExternalFromJiraKey('  ')).toBeNull();
  });

  it('builds and parses work item pm_external', () => {
    const built = buildJiraWorkItemPmExternal('ABC-1');
    expect(built).toEqual({ vendor: 'jira', issue_key: 'ABC-1' });
    expect(jiraIssueKeyFromPmExternal(built)).toBe('ABC-1');
    expect(workItemPmExternalFromJiraKey('')).toBeNull();
  });

  it('maps DTO aliases onto rows', () => {
    expect(
      withJiraProjectDtoFields({
        pm_connection_id: 'conn-1',
        pm_external: { vendor: 'jira', project_key: 'XYZ' },
      })
    ).toMatchObject({
      jira_connection_id: 'conn-1',
      jira_project_key: 'XYZ',
    });

    expect(
      withJiraIssueKeyDtoField({
        pm_external: { vendor: 'jira', issue_key: 'XYZ-9' },
      })
    ).toMatchObject({ jira_issue_key: 'XYZ-9' });
  });
});
