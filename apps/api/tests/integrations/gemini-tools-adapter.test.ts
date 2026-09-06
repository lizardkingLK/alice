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
});
