import { describe, expect, it } from 'vitest';
import {
  parseCreateWorkItemFormData,
  parsePatchWorkItemFormData,
} from '@/app/work-items/_helpers/work-item-mutation-body';

describe('Work Item mutation parsing', () => {
  it('returns a readable validation message when Type is missing', () => {
    const formData = new FormData();
    formData.set('title', 'Work item without a type');
    formData.set('project_id', '00000000-0000-4000-8000-000000000001');

    expect(() => parseCreateWorkItemFormData(formData)).toThrowError(
      /^Please select a work item type$/
    );
  });

  it('accepts TipTap JSON description on patch form data', () => {
    const formData = new FormData();
    formData.set('title', 'Updated title');
    formData.set(
      'description',
      JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      })
    );

    const body = parsePatchWorkItemFormData(
      formData,
      '2026-01-01T00:00:00.000Z'
    );

    expect(body.description).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    });
  });

  it('does not hard-fail when patch description is plain text', () => {
    const formData = new FormData();
    formData.set('title', 'Updated title');
    formData.set('description', 'sfsdfsdf');

    const body = parsePatchWorkItemFormData(
      formData,
      '2026-01-01T00:00:00.000Z'
    );

    expect(body.description).toBe('sfsdfsdf');
  });
});
