import { describe, expect, it } from 'vitest';
import {
  chatMessageWireSchema,
  createSeededDefaultWorkflowConfig,
  postChatMessageBodySchema,
} from '@repo/types/api/v1';

describe('chat v1 schemas', () => {
  it('parses a valid post body with integration id', () => {
    const parsed = postChatMessageBodySchema.safeParse({
      messages: [{ role: 'user', content: 'Hello Alice' }],
      integrationId: '22222222-2222-4222-8222-222222222222',
    });

    expect(parsed.success).toBe(true);
  });

  it('parses a post body with workflow designer view context', () => {
    const parsed = postChatMessageBodySchema.safeParse({
      messages: [{ role: 'user', content: 'Add a QA state' }],
      viewContext: {
        surface: 'workflow_designer',
        projectId: '22222222-2222-4222-8222-222222222222',
        draftEnvelope: createSeededDefaultWorkflowConfig(),
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        dirty: false,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty message arrays', () => {
    expect(postChatMessageBodySchema.safeParse({ messages: [] }).success).toBe(
      false
    );
  });

  it('accepts wire messages with optional tool actions', () => {
    expect(
      chatMessageWireSchema.safeParse({
        id: 'msg-1',
        role: 'assistant',
        content: 'Created your project.',
        actions: [
          {
            type: 'create_project',
            entity: {
              id: '33333333-3333-4333-8333-333333333333',
              name: 'Alpha',
            },
          },
        ],
      }).success
    ).toBe(true);
  });
});
