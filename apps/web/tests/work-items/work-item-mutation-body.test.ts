import { describe, expect, it } from 'vitest';
import { parseCreateWorkItemFormData } from '@/app/work-items/_helpers/work-item-mutation-body';

describe('Work Item mutation parsing', () => {
  it('returns a readable validation message when Type is missing', () => {
    const formData = new FormData();
    formData.set('title', 'Work item without a type');
    formData.set('project_id', '00000000-0000-4000-8000-000000000001');

    expect(() => parseCreateWorkItemFormData(formData)).toThrowError(
      /^Please select a work item type$/
    );
  });
});
