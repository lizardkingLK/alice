import { describe, expect, it } from 'vitest';
import { ChatTurnRoles } from '@repo/types';
import {
  aliceChatToolsToOpenAiTools,
  chatContentsToOpenAiMessages,
  openAiChatCompletionToChatLlmResponse,
  resolveSpaceXAIUserFacingError,
} from '../../src/routes/api/integrations/chat-providers/spacexai/spacexai-openai-adapter';

describe('aliceChatToolsToOpenAiTools', () => {
  it('maps Alice chat tools into OpenAI tools', () => {
    const tools = aliceChatToolsToOpenAiTools([
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
    ]);

    expect(tools).toEqual([
      {
        type: 'function',
        function: {
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
      },
    ]);
  });

  it('always includes parameters for xAI (empty object schema when none)', () => {
    expect(
      aliceChatToolsToOpenAiTools([
        {
          name: 'list_projects',
          description: 'List projects',
        },
      ])
    ).toEqual([
      {
        type: 'function',
        function: {
          name: 'list_projects',
          description: 'List projects',
          parameters: { type: 'object', properties: {} },
        },
      },
    ]);
  });
});

describe('chatContentsToOpenAiMessages', () => {
  it('adds system instruction and maps user/model text turns', () => {
    const messages = chatContentsToOpenAiMessages('You are Alice.', [
      { role: ChatTurnRoles.User, parts: [{ text: 'Hi' }] },
      { role: ChatTurnRoles.Model, parts: [{ text: 'Hello' }] },
    ]);

    expect(messages).toEqual([
      { role: 'system', content: 'You are Alice.' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);
  });

  it('maps functionCall / functionResponse turns to tool messages', () => {
    const messages = chatContentsToOpenAiMessages('sys', [
      { role: ChatTurnRoles.User, parts: [{ text: 'list projects' }] },
      {
        role: ChatTurnRoles.Model,
        parts: [{ functionCall: { name: 'list_projects', args: {} } }],
      },
      {
        role: ChatTurnRoles.User,
        parts: [
          {
            functionResponse: {
              name: 'list_projects',
              response: { result: [{ id: 'p1' }] },
            },
          },
        ],
      },
    ]);

    expect(messages[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'list_projects', arguments: '{}' },
        },
      ],
    });
    expect(messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: JSON.stringify([{ id: 'p1' }]),
    });
  });
});

describe('openAiChatCompletionToChatLlmResponse', () => {
  it('maps assistant text to ChatLlmResponse candidates', () => {
    expect(
      openAiChatCompletionToChatLlmResponse({
        choices: [{ message: { content: 'Done' } }],
      })
    ).toEqual({
      candidates: [
        {
          content: {
            role: ChatTurnRoles.Model,
            parts: [{ text: 'Done' }],
          },
        },
      ],
    });
  });

  it('maps tool_calls to functionCall parts', () => {
    expect(
      openAiChatCompletionToChatLlmResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'create_project',
                    arguments: '{"name":"A","key":"A"}',
                  },
                },
              ],
            },
          },
        ],
      })
    ).toEqual({
      candidates: [
        {
          content: {
            role: ChatTurnRoles.Model,
            parts: [
              {
                functionCall: {
                  name: 'create_project',
                  args: { name: 'A', key: 'A' },
                },
              },
            ],
          },
        },
      ],
    });
  });
});

describe('resolveSpaceXAIUserFacingError', () => {
  it('guides on auth failures', () => {
    expect(
      resolveSpaceXAIUserFacingError({
        status: 401,
        errorBody: '{}',
        modelId: 'grok-4.3',
      })
    ).toContain('API key');
  });

  it('surfaces plain-text 422 bodies from xAI', () => {
    expect(
      resolveSpaceXAIUserFacingError({
        status: 422,
        errorBody:
          'Failed to deserialize the JSON body into the target type: tools[0]: missing field `parameters`',
        modelId: 'grok-4.3',
      })
    ).toContain('missing field `parameters`');
  });
});
