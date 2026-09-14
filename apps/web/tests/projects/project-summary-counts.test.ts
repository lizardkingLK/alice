import { describe, expect, it } from 'vitest';
import {
  countProjectFields,
  countProjectIntegrations,
} from '@/app/projects/_helpers/project-summary-counts';
import type { Project } from '@/app/projects/_types/projects.types';

const baseProject = {
  id: 'project-1',
  name: 'Demo',
  key: 'DEMO',
  description: null,
  status: 'active',
  start_date: null,
  end_date: null,
  owner_id: 'user-1',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  updated_by: null,
  jira_project_key: null,
  jira_connection_id: null,
  github_repo: null,
  logo_url: null,
  cover_picture: null,
  attributes_config: null,
  workflow_config: null,
} as Project;

describe('countProjectFields', () => {
  it('counts JSON Schema properties', () => {
    expect(
      countProjectFields({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'number' } },
      })
    ).toBe(2);
  });

  it('returns 0 for missing or empty config', () => {
    expect(countProjectFields(null)).toBe(0);
    expect(countProjectFields({ type: 'object' })).toBe(0);
  });
});

describe('countProjectIntegrations', () => {
  it('counts linked Jira and GitHub', () => {
    expect(
      countProjectIntegrations({
        ...baseProject,
        jira_connection_id: 'conn-1',
        jira_project_key: 'JIRA',
        github_repo: 'org/repo',
      })
    ).toBe(2);
  });

  it('returns 0 when nothing is linked', () => {
    expect(countProjectIntegrations(baseProject)).toBe(0);
  });
});
