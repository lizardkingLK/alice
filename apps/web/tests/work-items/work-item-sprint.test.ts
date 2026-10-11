import { describe, expect, it } from 'vitest';
import {
  selectValueFromSprintId,
  sprintIdFromSelectValue,
  WORK_ITEM_SPRINT_BACKLOG_VALUE,
} from '@/app/work-items/_helpers/work-item-sprint';

describe('work-item sprint helpers', () => {
  it('maps backlog sentinel to null sprint id', () => {
    expect(sprintIdFromSelectValue(WORK_ITEM_SPRINT_BACKLOG_VALUE)).toBeNull();
    expect(sprintIdFromSelectValue('')).toBeNull();
    expect(sprintIdFromSelectValue('sprint-1')).toBe('sprint-1');
  });

  it('maps null sprint id to backlog sentinel', () => {
    expect(selectValueFromSprintId(null)).toBe(WORK_ITEM_SPRINT_BACKLOG_VALUE);
    expect(selectValueFromSprintId(undefined)).toBe(
      WORK_ITEM_SPRINT_BACKLOG_VALUE
    );
    expect(selectValueFromSprintId('sprint-1')).toBe('sprint-1');
  });
});
