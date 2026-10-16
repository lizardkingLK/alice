import { ChatTurnRoles } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { aliceChatTools } from '../../src/routes/api/chat/chat.route.data';
import type { AliceChatTools } from '../../src/routes/api/chat/chat.route.types';
import {
  aliceChatToolsToAnthropicTools,
  anthropicMessageResponseToChatLlmResponse,
  anthropicMessageToChatLlmResponse,
  chatContentsToAnthropicMessages,
} from '../../src/routes/api/integrations/chat-providers/anthropic-chat-adapter';

const tools: AliceChatTools = [
  {
    name: 'list_projects',
    description: 'List accessible projects',
  },
  {
    name: 'list_users',
    description: 'List users',
  },
  {
    name: 'create_project',
    description: 'Create a project',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        key: { type: 'string' },
        private: { type: 'boolean' },
      },
      required: ['name', 'key'],
    },
  },
];

function messageResponse(
  content: unknown[],
  stopReason: string = 'end_turn'
): Record<string, unknown> {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content,
    stop_reason: stopReason,
  };
}

function capturedError(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected callback to throw.');
}

describe('aliceChatToolsToAnthropicTools', () => {
  it('maps Alice tools to Anthropic input_schema definitions', () => {
    expect(aliceChatToolsToAnthropicTools(tools)).toEqual([
      {
        name: 'list_projects',
        description: 'List accessible projects',
        input_schema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: 'list_users',
        description: 'List users',
        input_schema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: 'create_project',
        description: 'Create a project',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            key: { type: 'string' },
            private: { type: 'boolean' },
          },
          required: ['name', 'key'],
        },
      },
    ]);
  });

  it('closes the schemas of production tools with no parameters', () => {
    const parameterlessTools = aliceChatTools.filter(
      (tool) => tool.name === 'list_projects' || tool.name === 'list_users'
    );

    expect(parameterlessTools).toHaveLength(2);
    expect(parameterlessTools.every((tool) => !tool.parameters)).toBe(true);
    expect(aliceChatToolsToAnthropicTools(parameterlessTools)).toEqual(
      parameterlessTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      }))
    );
  });
});

describe('chatContentsToAnthropicMessages', () => {
  it('maps text history and merges adjacent roles to keep alternating turns', () => {
    expect(
      chatContentsToAnthropicMessages([
        { role: ChatTurnRoles.User, parts: [{ text: 'Hello' }] },
        { role: ChatTurnRoles.User, parts: [{ text: 'Are you there?' }] },
        { role: ChatTurnRoles.Model, parts: [{ text: 'Yes.' }] },
      ])
    ).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'Are you there?' },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Yes.' }],
      },
    ]);
  });

  it('preserves assistant tool context and matches multiple tool results', () => {
    expect(
      chatContentsToAnthropicMessages([
        {
          role: ChatTurnRoles.User,
          parts: [{ text: 'List and create' }],
        },
        {
          role: ChatTurnRoles.Model,
          parts: [
            { text: 'I will do both.' },
            {
              functionCall: {
                id: 'toolu_list',
                name: 'list_projects',
                args: {},
              },
            },
            {
              functionCall: {
                id: 'toolu_create',
                name: 'create_project',
                args: { name: 'Alpha', key: 'ALPHA' },
              },
            },
          ],
        },
        {
          role: ChatTurnRoles.User,
          parts: [
            {
              functionResponse: {
                id: 'toolu_list',
                name: 'list_projects',
                response: { result: [{ id: 'p1' }] },
              },
            },
            {
              functionResponse: {
                id: 'toolu_create',
                name: 'create_project',
                response: { result: { id: 'p2' } },
              },
            },
          ],
        },
      ])
    ).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'List and create' }],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will do both.' },
          {
            type: 'tool_use',
            id: 'toolu_list',
            name: 'list_projects',
            input: {},
          },
          {
            type: 'tool_use',
            id: 'toolu_create',
            name: 'create_project',
            input: { name: 'Alpha', key: 'ALPHA' },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_list',
            content: JSON.stringify([{ id: 'p1' }]),
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_create',
            content: JSON.stringify({ id: 'p2' }),
          },
        ],
      },
    ]);
  });

  it('creates and reuses a synthetic id for providers without tool-call ids', () => {
    const messages = chatContentsToAnthropicMessages([
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
              response: { result: [] },
            },
          },
        ],
      },
    ]);

    expect(messages[0]?.content[0]).toMatchObject({
      type: 'tool_use',
      id: 'toolu_alice_1',
    });
    expect(messages[1]?.content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_alice_1',
      content: '[]',
    });
  });

  it.each([
    [
      [
        {
          role: ChatTurnRoles.Model,
          parts: [
            {
              functionResponse: {
                id: 'toolu_1',
                name: 'list_projects',
                response: { result: [] },
              },
            },
          ],
        },
      ],
      'assistant tool result',
    ],
    [
      [
        {
          role: ChatTurnRoles.User,
          parts: [{ functionCall: { name: 'list_projects', args: {} } }],
        },
      ],
      'user tool use',
    ],
    [
      [
        {
          role: ChatTurnRoles.Model,
          parts: [
            {
              functionCall: {
                id: 'toolu_1',
                name: 'list_projects',
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
                id: 'toolu_wrong',
                name: 'list_projects',
                response: { result: [] },
              },
            },
          ],
        },
      ],
      'unmatched result id',
    ],
  ])('rejects invalid conversation tool context: %s', (contents, _label) => {
    expect(() => chatContentsToAnthropicMessages(contents)).toThrow(
      'Anthropic conversation contains invalid tool context.'
    );
  });
});

describe('anthropicMessageToChatLlmResponse', () => {
  it.each(['list_projects', 'list_users'])(
    'accepts an empty input object for production %s and preserves its id',
    (toolName) => {
      const result = anthropicMessageToChatLlmResponse(
        messageResponse(
          [
            {
              type: 'tool_use',
              id: `toolu_${toolName}`,
              name: toolName,
              input: {},
            },
          ],
          'tool_use'
        ),
        aliceChatTools
      );

      expect(result.candidates?.[0]?.content?.parts).toEqual([
        {
          functionCall: {
            id: `toolu_${toolName}`,
            name: toolName,
            args: {},
          },
        },
      ]);
    }
  );

  it('rejects unexpected arguments for production list_projects', () => {
    expect(
      capturedError(() =>
        anthropicMessageToChatLlmResponse(
          messageResponse(
            [
              {
                type: 'tool_use',
                id: 'toolu_projects',
                name: 'list_projects',
                input: { assigned: true },
              },
            ],
            'tool_use'
          ),
          aliceChatTools
        )
      )
    ).toMatchObject({
      message: 'Anthropic returned an invalid response.',
      category: 'invalid_tool_arguments',
    });
  });

  it('rejects unknown production tool names', () => {
    expect(
      capturedError(() =>
        anthropicMessageToChatLlmResponse(
          messageResponse(
            [
              {
                type: 'tool_use',
                id: 'toolu_unknown',
                name: 'unknown_tool',
                input: {},
              },
            ],
            'tool_use'
          ),
          aliceChatTools
        )
      )
    ).toMatchObject({
      message: 'Anthropic returned an invalid response.',
      category: 'unknown_tool',
    });
  });

  it('maps multiple text blocks', () => {
    expect(
      anthropicMessageToChatLlmResponse(
        messageResponse([
          { type: 'text', text: 'First' },
          { type: 'text', text: 'Second' },
        ]),
        tools
      )
    ).toEqual({
      candidates: [
        {
          content: {
            role: ChatTurnRoles.Model,
            parts: [{ text: 'First' }, { text: 'Second' }],
          },
        },
      ],
    });
  });

  it('maps mixed text and multiple valid tool calls', () => {
    const result = anthropicMessageToChatLlmResponse(
      messageResponse(
        [
          { type: 'text', text: 'I will use two tools.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_projects',
            input: {},
          },
          {
            type: 'tool_use',
            id: 'toolu_2',
            name: 'create_project',
            input: { name: 'Alpha', key: 'ALPHA', private: true },
          },
        ],
        'tool_use'
      ),
      tools
    );

    expect(result.candidates?.[0]?.content?.parts).toEqual([
      { text: 'I will use two tools.' },
      {
        functionCall: { id: 'toolu_1', name: 'list_projects', args: {} },
      },
      {
        functionCall: {
          id: 'toolu_2',
          name: 'create_project',
          args: { name: 'Alpha', key: 'ALPHA', private: true },
        },
      },
    ]);
  });

  it.each([
    [
      messageResponse(
        [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'missing_tool',
            input: {},
          },
        ],
        'tool_use'
      ),
      'unknown tool',
      'unknown_tool',
    ],
    [
      messageResponse(
        [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'create_project',
            input: { name: 'Alpha' },
          },
        ],
        'tool_use'
      ),
      'missing required argument',
      'invalid_tool_arguments',
    ],
    [
      messageResponse(
        [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'create_project',
            input: { name: 'Alpha', key: 42 },
          },
        ],
        'tool_use'
      ),
      'wrong argument type',
      'invalid_tool_arguments',
    ],
    [
      messageResponse(
        [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_projects',
            input: {},
          },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_projects',
            input: {},
          },
        ],
        'tool_use'
      ),
      'duplicate id',
      'invalid_response_shape',
    ],
    [
      messageResponse(
        [{ type: 'tool_use', name: 'list_projects', input: {} }],
        'tool_use'
      ),
      'missing id',
      'invalid_response_shape',
    ],
    [
      messageResponse([{ type: 'image', source: {} }]),
      'unexpected block',
      'unsupported_content_block',
    ],
    [messageResponse([], 'end_turn'), 'empty content', 'invalid_stop_reason'],
    [
      messageResponse([{ type: 'text', text: 'Done' }], 'tool_use'),
      'bad stop',
      'invalid_stop_reason',
    ],
    [
      messageResponse([{ type: 'text', text: 'Paused' }], 'pause_turn'),
      'pause',
      'invalid_stop_reason',
    ],
    [
      { type: 'message', content: [] },
      'missing required fields',
      'invalid_response_shape',
    ],
  ])('rejects malformed response safely: %s', (payload, _label, category) => {
    expect(
      capturedError(() => anthropicMessageToChatLlmResponse(payload, tools))
    ).toMatchObject({
      message: 'Anthropic returned an invalid response.',
      category,
    });
  });

  it('categorizes invalid JSON without including response content', async () => {
    const secret = 'sk-ant-response-secret';

    await expect(
      anthropicMessageResponseToChatLlmResponse(
        new Response(`${secret} {`),
        aliceChatTools
      )
    ).rejects.toMatchObject({
      message: 'Anthropic returned an invalid response.',
      category: 'invalid_json',
    });

    await expect(
      anthropicMessageResponseToChatLlmResponse(
        new Response(`${secret} {`),
        aliceChatTools
      )
    ).rejects.not.toThrow(secret);
  });

  it('distinguishes token-limit responses', () => {
    for (const stopReason of ['max_tokens', 'model_context_window_exceeded']) {
      expect(() =>
        anthropicMessageToChatLlmResponse(
          messageResponse([{ type: 'text', text: 'Partial' }], stopReason),
          tools
        )
      ).toThrow(/token limit/i);
    }
  });

  it('distinguishes refusals', () => {
    expect(() =>
      anthropicMessageToChatLlmResponse(
        messageResponse([{ type: 'text', text: 'No' }], 'refusal'),
        tools
      )
    ).toThrow('Anthropic declined this request.');
  });
});
