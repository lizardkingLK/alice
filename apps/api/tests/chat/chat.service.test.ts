import { describe, it, expect, vi } from 'vitest';

const { mockClient } = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  const mockEq = () => Promise.resolve({ data: [], error: null });
  const mockSelect = () => ({ eq: mockEq });
  const mockFrom = () => ({ select: mockSelect });
  return {
    mockClient: {
      from: mockFrom,
      storage: {
        listBuckets: () => Promise.resolve({ data: [], error: null }),
        createBucket: () => Promise.resolve({ data: null, error: null }),
        from: () => ({
          upload: () => Promise.resolve({ error: null }),
          download: () =>
            Promise.resolve({ data: null, error: { status: 404 } }),
          remove: () => Promise.resolve({ error: null }),
        }),
      },
    },
  };
});

vi.mock('../../src/lib/supabase', () => ({
  createClient: () => mockClient,
  supabase: mockClient,
}));

import { ChatRoles, ChatAttachmentFileTypeEnum } from '@repo/types';
import {
  ChatService,
  chatHistoryToMarkdown,
  markdownToChatHistory,
} from '../../src/routes/api/chat/chat.service';
import type { StoredChatMessage } from '../../src/routes/api/chat/chat.route.types';

describe('Chat History Markdown Serialization', () => {
  it('should serialize and deserialize chat history losslessly', () => {
    const conversationId = 'test-conversation-id';
    const messages: StoredChatMessage[] = [
      {
        id: 'msg-1',
        role: ChatRoles.User,
        content: 'Hello, bot!',
      },
      {
        id: 'msg-2',
        role: ChatRoles.Assistant,
        content: 'Hello user, how can I assist you?',
        actions: [
          {
            type: 'create_project',
            entity: { id: 'proj-1', name: 'Project One', key: 'PROJ1' },
          },
        ],
      },
    ];

    const md = chatHistoryToMarkdown(conversationId, messages);
    expect(md).toContain(
      '# Chat History for Conversation: test-conversation-id'
    );
    expect(md).toContain('<!-- JSON_HISTORY_DATA_START');
    expect(md).toContain('JSON_HISTORY_DATA_END -->');

    const parsed = markdownToChatHistory(md);
    expect(parsed).toEqual(messages);
    expect(parsed).toHaveLength(2);
    const secondMsg = parsed[1];
    expect(secondMsg).toBeDefined();
    expect(secondMsg?.actions).toBeDefined();
    expect(secondMsg?.actions?.[0]?.type).toBe('create_project');
  });

  it('should serialize messages with attachments and format them in markdown', () => {
    const conversationId = 'conv-with-attachments';
    const messages: StoredChatMessage[] = [
      {
        id: 'msg-1',
        role: ChatRoles.User,
        content: 'Please import these items',
        attachments: [
          {
            id: 'att-1',
            fileName: 'tasks.json',
            fileSize: 2048,
            mimeType: 'application/json',
            storagePath: 'chat-attachments/user-1/tasks.json',
            url: 'https://storage.example.com/file.json',
            fileType: ChatAttachmentFileTypeEnum.Json,
          },
        ],
      },
    ];

    const md = chatHistoryToMarkdown(conversationId, messages);
    expect(md).toContain('*Attached Files:*');
    expect(md).toContain('[tasks.json](https://storage.example.com/file.json)');

    const parsed = markdownToChatHistory(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.attachments).toHaveLength(1);
    expect(parsed[0]?.attachments?.[0]?.fileName).toBe('tasks.json');
  });

  it('should return empty array on invalid or missing metadata', () => {
    const invalidMd = '# Not a real chat history markdown';
    const parsed = markdownToChatHistory(invalidMd);
    expect(parsed).toEqual([]);
  });
});

describe('Dynamic Fields Schema Generation and Merging', () => {
  it('should generate fields from raw tool call fields', () => {
    const chatService = new ChatService({
      chat: {} as never,
      workItemService: {} as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      projectsRepository: {} as never,
      integrationsService: {} as never,
    });

    const res = chatService.handleGenerateProjectFieldsSchema({
      fields: [
        {
          key: 'securityClassification',
          type: 'string',
          title: 'Security Classification',
          enum: ['Public', 'Internal', 'Confidential', 'Restricted'],
        },
        {
          key: 'complianceTier',
          type: 'string',
          title: 'Compliance Tier',
          enum: ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
        },
      ],
    }) as { success: boolean; schema: { properties: Record<string, unknown> } };

    expect(res.success).toBe(true);
    expect(res.schema.properties).toHaveProperty('securityClassification');
    expect(res.schema.properties).toHaveProperty('complianceTier');
  });

  it('should preserve and merge existing fields when currentSchema is provided', async () => {
    const chatService = new ChatService({
      chat: {} as never,
      workItemService: {} as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      projectsRepository: {} as never,
      integrationsService: {
        resolveChatModelForChat: vi.fn().mockResolvedValue({}),
      } as never,
    });

    // Mock callChatModelAPI to return 2 new fields
    vi.spyOn(
      chatService as unknown as {
        callChatModelAPI: (
          _model: unknown,
          _messages: unknown
        ) => Promise<unknown>;
      },
      'callChatModelAPI'
    ).mockResolvedValue({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: JSON.stringify({
                  $schema: 'https://json-schema.org/draft/2020-12/schema',
                  type: 'object',
                  properties: {
                    securityClassification: {
                      type: 'string',
                      title: 'Security Classification',
                      enum: [
                        'Public',
                        'Internal',
                        'Confidential',
                        'Restricted',
                      ],
                    },
                    complianceTier: {
                      type: 'string',
                      title: 'Compliance Tier',
                      enum: ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
                    },
                  },
                  additionalProperties: true,
                }),
              },
            ],
          },
        },
      ],
    } as never);

    const existingTemplateSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        moscowRating: {
          type: 'string',
          title: 'MoSCoW Rating',
          enum: ['Must Have', 'Should Have', 'Could Have', "Won't Have"],
        },
        acceptanceCriteria: {
          type: 'string',
          title: 'Acceptance Criteria',
          format: 'multiline',
        },
        businessValue: {
          type: 'integer',
          title: 'Business Value',
        },
        releaseNotesIncluded: {
          type: 'boolean',
          title: 'Release Notes Included',
        },
      },
      additionalProperties: true,
    };

    const merged = await chatService.generateProjectFieldsSchema(
      'Security classification and compliance tier',
      existingTemplateSchema
    );

    // Verify that ALL 6 fields are preserved!
    expect(Object.keys(merged.properties || {})).toHaveLength(6);
    expect(merged.properties).toHaveProperty('moscowRating');
    expect(merged.properties).toHaveProperty('acceptanceCriteria');
    expect(merged.properties).toHaveProperty('businessValue');
    expect(merged.properties).toHaveProperty('releaseNotesIncluded');
    expect(merged.properties).toHaveProperty('securityClassification');
    expect(merged.properties).toHaveProperty('complianceTier');
  });
});
