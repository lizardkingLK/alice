import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProjectSchema,
  updateProjectSchema,
} from '../../src/routes/api/projects/projects.schemas';

const validCreateInput = {
  name: 'Alice Project',
  key: 'ALICE',
  description: 'A description',
  owner_id: '11111111-1111-4111-8111-111111111111',
  start_date: '2026-08-25',
  end_date: '2026-08-30',
  status: 'active' as const,
};

const validBoardConfig = {
  version: '1',
  columns: [
    { id: 'new', name: 'New', status: 'New' },
    { id: 'todo', name: 'Ready', status: 'ToDo' },
    { id: 'doing', name: 'Doing', status: 'InProgress' },
    { id: 'testing', name: 'Testing', status: 'Testing' },
    { id: 'done', name: 'Done', status: 'Done' },
  ],
};

describe('projects schemas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'));
  });

  describe('createProjectSchema', () => {
    it('accepts valid input', () => {
      const parsed = createProjectSchema.safeParse(validCreateInput);
      expect(parsed.success).toBe(true);
    });

    it('accepts workflow config in the create contract', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        workflow_config: {
          work_item_types: ['Epic', 'Story', 'Task', 'Issue'],
        },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.workflow_config).toEqual({
          work_item_types: ['Epic', 'Story', 'Task', 'Issue'],
        });
      }
    });

    it('accepts valid nested sprint configuration', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        sprint: {
          name: 'Sprint 1',
          goal: 'Ship the first increment',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
        },
      });

      expect(parsed.success).toBe(true);
    });

    it('rejects invalid nested sprint configuration', () => {
      const invalidSprints = [
        {
          name: '',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
        },
        {
          name: 'x'.repeat(201),
          startDate: '2026-09-01',
          endDate: '2026-09-14',
        },
        {
          name: 'Sprint 1',
          startDate: '09/01/2026',
          endDate: '2026-09-14',
        },
        {
          name: 'Sprint 1',
          startDate: '2026-09-14',
          endDate: '2026-09-01',
        },
      ];

      for (const sprint of invalidSprints) {
        expect(
          createProjectSchema.safeParse({ ...validCreateInput, sprint }).success
        ).toBe(false);
      }
    });

    it('does not accept a projectId in nested sprint configuration', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        sprint: {
          name: 'Sprint 1',
          projectId: '33333333-3333-4333-8333-333333333333',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
        },
      });

      expect(parsed.success).toBe(false);
    });

    it('rejects end_date in the past', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        start_date: null,
        end_date: '2026-08-24',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(
          'End date cannot be a past date.'
        );
      }
    });

    it('rejects end_date before start_date', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        start_date: '2026-08-28',
        end_date: '2026-08-27',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(
          'End date must be on or after the start date.'
        );
      }
    });

    it('allows end_date on the start_date', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        start_date: '2026-08-28',
        end_date: '2026-08-28',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects start_date in the past', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        start_date: '2026-08-24',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(
          'Start date cannot be a past date.'
        );
      }
    });
  });

  describe('updateProjectSchema', () => {
    it('accepts a valid workflow config', () => {
      expect(
        updateProjectSchema.safeParse({
          workflow_config: validBoardConfig,
          expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
        }).success
      ).toBe(true);
    });

    it('accepts null workflow config for reset', () => {
      expect(
        updateProjectSchema.safeParse({
          workflow_config: null,
          expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
        }).success
      ).toBe(true);
    });

    it('rejects an invalid workflow config', () => {
      expect(
        updateProjectSchema.safeParse({
          workflow_config: {
            ...validBoardConfig,
            columns: validBoardConfig.columns.slice(1),
          },
          expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
        }).success
      ).toBe(false);
    });

    it('accepts partial valid input', () => {
      const parsed = updateProjectSchema.safeParse({
        name: 'New Name',
        expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
      });
      expect(parsed.success).toBe(true);
    });

    it('allows past end_date on update', () => {
      const parsed = updateProjectSchema.safeParse({
        end_date: '2026-08-24',
        expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
      });
      expect(parsed.success).toBe(true);
    });

    it('allows past start_date on update', () => {
      const parsed = updateProjectSchema.safeParse({
        start_date: '2026-08-24',
        expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects end_date before start_date on update', () => {
      const parsed = updateProjectSchema.safeParse({
        start_date: '2026-08-28',
        end_date: '2026-08-27',
        expectedUpdatedAt: '2026-08-25T12:00:00.000Z',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(
          'End date must be on or after the start date.'
        );
      }
    });
  });
});
