import { describe, expect, it } from 'vitest';
import {
  createSavedViewBodySchema,
  listSavedViewsQuerySchema,
  savedViewWireSchema,
  shareSavedViewBodySchema,
} from '@repo/types/api/v1';

const savedViewWire = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: '22222222-2222-4222-8222-222222222222',
  title: 'My backlog filter',
  description: null,
  pathname: '/backlog',
  search: 'status=active',
  project_id: null,
  status: 'active',
  created_by: '22222222-2222-4222-8222-222222222222',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: '22222222-2222-4222-8222-222222222222',
  updated_at: '2026-01-01T00:00:00.000Z',
} as const;

describe('saved-views v1 schemas', () => {
  it('parses create body with normalized search default', () => {
    const parsed = createSavedViewBodySchema.safeParse({
      title: 'Sprint board',
      pathname: '/board',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.search).toBe('');
    }
  });

  it('rejects empty share recipient lists', () => {
    expect(shareSavedViewBodySchema.safeParse({ userIds: [] }).success).toBe(
      false
    );
  });

  it('defaults list query tab to mine', () => {
    const parsed = listSavedViewsQuerySchema.safeParse({ page: '2' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({ page: 2, tab: 'mine' });
    }
  });

  it('accepts wire rows with ISO date strings', () => {
    expect(savedViewWireSchema.safeParse(savedViewWire).success).toBe(true);
  });
});
