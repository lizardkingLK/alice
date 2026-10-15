import { describe, expect, it } from 'vitest';
import { ChatTurnRoles } from '@repo/types';
import type { AliceChatTools } from '../../src/routes/api/chat/chat.route.types';
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
  const toolSchemas: AliceChatTools = [
    {
      name: 'list_projects',
      description: 'List projects',
      parameters: { type: 'object' as const, properties: {} },
    },
    {
      name: 'create_project',
      description: 'Create a project',
      parameters: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          key: { type: 'string' },
        },
        required: ['name', 'key'],
      },
    },
  ];

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
                  id: 'call_1',
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

  it('accepts an explicitly supplied empty object for a tool with no required arguments', () => {
    expect(
      openAiChatCompletionToChatLlmResponse(
        {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'list_projects',
                      arguments: '{}',
                    },
                  },
                ],
              },
            },
          ],
        },
        'SpaceXAI',
        toolSchemas
      ).candidates?.[0]?.content?.parts[0]?.functionCall?.args
    ).toEqual({});
  });

  it.each([
    ['', 'empty argument string'],
    ['{"name":"Alice"}', 'missing required key'],
    ['{"name":"Alice","key":42}', 'wrong argument type'],
  ])('rejects %s before tool execution (%s)', (argumentsJson) => {
    expect(() =>
      openAiChatCompletionToChatLlmResponse(
        {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'create_project',
                      arguments: argumentsJson,
                    },
                  },
                ],
              },
            },
          ],
        },
        'SpaceXAI',
        toolSchemas
      )
    ).toThrow('SpaceXAI returned an invalid response.');
  });

  it('rejects duplicate tool-call ids in one provider response', () => {
    expect(() =>
      openAiChatCompletionToChatLlmResponse(
        {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_duplicate',
                    type: 'function',
                    function: {
                      name: 'list_projects',
                      arguments: '{}',
                    },
                  },
                  {
                    id: 'call_duplicate',
                    type: 'function',
                    function: {
                      name: 'list_projects',
                      arguments: '{}',
                    },
                  },
                ],
              },
            },
          ],
        },
        'SpaceXAI',
        toolSchemas
      )
    ).toThrow('SpaceXAI returned an invalid response.');
  });

  it('accepts multiple valid tool calls with unique ids', () => {
    const response = openAiChatCompletionToChatLlmResponse(
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'list_projects', arguments: '{}' },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: { name: 'list_projects', arguments: '{}' },
                },
              ],
            },
          },
        ],
      },
      'SpaceXAI',
      toolSchemas
    );

    expect(
      response.candidates?.[0]?.content?.parts.map(
        (part) => part.functionCall?.id
      )
    ).toEqual(['call_1', 'call_2']);
  });

  it('preserves multiple tool-call ids across the following tool results', () => {
    const messages = chatContentsToOpenAiMessages('sys', [
      {
        role: ChatTurnRoles.Model,
        parts: [
          {
            functionCall: {
              id: 'call_projects',
              name: 'list_projects',
              args: {},
            },
          },
          {
            functionCall: {
              id: 'call_users',
              name: 'list_users',
              args: {},
            },
          },
        ],
      },
      {
        role: ChatTurnRoles.User,
        parts: [
          {
            functionResponse: {
              id: 'call_projects',
              name: 'list_projects',
              response: { result: [{ id: 'p1' }] },
            },
          },
          {
            functionResponse: {
              id: 'call_users',
              name: 'list_users',
              response: { result: [{ id: 'u1' }] },
            },
          },
        ],
      },
    ]);

    expect(messages[1]).toMatchObject({
      tool_calls: [{ id: 'call_projects' }, { id: 'call_users' }],
    });
    expect(messages.slice(2)).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call_projects',
        content: JSON.stringify([{ id: 'p1' }]),
      },
      {
        role: 'tool',
        tool_call_id: 'call_users',
        content: JSON.stringify([{ id: 'u1' }]),
      },
    ]);
  });

  it.each([
    {},
    { choices: [] },
    { choices: [{ message: { tool_calls: {} } }] },
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'list_projects', arguments: '{bad json' },
              },
            ],
          },
        },
      ],
    },
    {
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'list_projects', arguments: '[]' },
              },
            ],
          },
        },
      ],
    },
  ])('rejects malformed provider responses safely', (payload) => {
    expect(() => openAiChatCompletionToChatLlmResponse(payload)).toThrow(
      'OpenAI-compatible provider returned an invalid response.'
    );
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

  it('does not expose plain-text 422 response bodies from xAI', () => {
    const responseBody =
      'Authorization: Bearer sk-sensitive; tools[0]: missing field `parameters`';
    const message = resolveSpaceXAIUserFacingError({
      status: 422,
      errorBody: responseBody,
      modelId: 'grok-4.3',
    });

    expect(message).toBe(
      'SpaceXAI rejected the request. Check the configured model and try again.'
    );
    expect(message).not.toContain(responseBody);
    expect(message).not.toContain('sk-sensitive');
  });
});
