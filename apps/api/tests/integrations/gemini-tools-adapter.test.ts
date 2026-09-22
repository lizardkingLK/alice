import { describe, expect, it } from 'vitest';
import { aliceChatToolsToGeminiTools } from '../../src/routes/api/integrations/chat-providers/gemini/gemini-tools-adapter';

describe('aliceChatToolsToGeminiTools', () => {
  it('maps Alice chat tools into Gemini functionDeclarations', () => {
    expect(
      aliceChatToolsToGeminiTools([
        {
          name: 'list_projects',
          description: 'List projects',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'string', description: 'Max rows' },
            },
            required: ['limit'],
          },
        },
      ])
    ).toEqual([
      {
        functionDeclarations: [
          {
            name: 'list_projects',
            description: 'List projects',
            parameters: {
              type: 'OBJECT',
              properties: {
                limit: { type: 'STRING', description: 'Max rows' },
              },
              required: ['limit'],
            },
          },
        ],
      },
    ]);
  });

  it('converts nested object and array schema types for board tool parameters', () => {
    const [envelope] = aliceChatToolsToGeminiTools([
      {
        name: 'configure_board_draft',
        description: 'Create a board draft',
        parameters: {
          type: 'object',
          properties: {
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
          required: ['columns'],
        },
      },
    ]);

    expect(envelope?.functionDeclarations[0]?.parameters).toMatchObject({
      type: 'OBJECT',
      properties: {
        columns: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { name: { type: 'STRING' } },
            required: ['name'],
          },
        },
      },
    });
  });
});
