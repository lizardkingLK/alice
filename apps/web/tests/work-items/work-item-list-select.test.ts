import { describe, expect, it } from 'vitest';
import {
  ASSIGNEE_SELECT,
  REPORTER_SELECT,
  workItemListSelect,
} from '@/app/work-items/_helpers/work-item-list-select';

describe('workItemListSelect', () => {
  it('omits TipTap description for compact list payloads', () => {
    const select = workItemListSelect(false);
    expect(select).not.toContain('description');
    expect(select).toContain('title');
    expect(select).toContain(ASSIGNEE_SELECT);
    expect(select).toContain(REPORTER_SELECT);
  });

  it('includes description when the board previews card text', () => {
    expect(workItemListSelect(true)).toContain('description');
  });

  it('exports assignee and reporter embeds for detail selects', () => {
    expect(ASSIGNEE_SELECT).toContain('assignee:users!assignee_id');
    expect(REPORTER_SELECT).toContain('reporter:users!reporter_id');
  });
});
