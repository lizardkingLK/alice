import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '../../src/routes/api/projects/projects.schemas';

const validCreateInput = {
  name: 'Alice Project',
  key: 'ALICE',
  description: 'A description',
  owner_id: '11111111-1111-4111-8111-111111111111',
  start_date: '2026-08-25',
  end_date: '2026-08-30',
  status: 'active' as const,
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

    it('rejects end_date in the past', () => {
      const parsed = createProjectSchema.safeParse({
        ...validCreateInput,
        start_date: null,
        end_date: '2026-08-24',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe('End date cannot be a past date.');
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
        expect(parsed.error.issues[0]?.message).toBe('End date must be on or after the start date.');
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
        expect(parsed.error.issues[0]?.message).toBe('Start date cannot be a past date.');
      }
    });
  });

  describe('updateProjectSchema', () => {
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
        expect(parsed.error.issues[0]?.message).toBe('End date must be on or after the start date.');
      }
    });
  });
});
