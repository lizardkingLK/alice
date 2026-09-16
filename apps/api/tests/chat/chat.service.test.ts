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

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_items: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import {
  ChatRoles,
  ChatAttachmentFileTypeEnum,
  WorkItemTypeEnum,
} from '@repo/types';
import { prisma } from '../../src/lib/prisma';
import {
  ChatService,
  chatHistoryToMarkdown,
  markdownToChatHistory,
} from '../../src/routes/api/chat/chat.service';
import {
  parseDelimitedWorkItemDocument,
  parseMarkdownTableWorkItemDocument,
} from '../../src/routes/api/chat/chat-attachment-parser';
import type {
  StoredChatMessage,
  ToolAction,
} from '../../src/routes/api/chat/chat.route.types';

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

describe('ChatService loadChatHistory with Expired Attachments', () => {
  it('automatically refreshes expired signed URLs for attachments in history', async () => {
    const expiredAttachment = {
      id: 'att-expired-1',
      fileName: 'specs.pdf',
      fileSize: 5000,
      mimeType: 'application/pdf',
      storagePath: 'chat-attachments/user-1/specs.pdf',
      url: 'https://storage.example.com/expired-url',
      fileType: ChatAttachmentFileTypeEnum.Other,
      expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    };

    const messages: StoredChatMessage[] = [
      {
        id: 'msg-1',
        role: ChatRoles.User,
        content: 'Check the attached doc',
        attachments: [expiredAttachment],
      },
    ];

    const markdownWithHistory = chatHistoryToMarkdown('conv-1', messages);

    const downloadHistoryMarkdownMock = vi
      .fn()
      .mockResolvedValue(markdownWithHistory);
    const saveChatHistoryMock = vi.fn().mockResolvedValue(undefined);

    const getAttachmentByIdMock = vi.fn().mockResolvedValue({
      ...expiredAttachment,
      url: 'https://storage.example.com/refreshed-url',
      previewUrl: 'https://storage.example.com/refreshed-url',
      downloadUrl: 'https://storage.example.com/refreshed-download-url',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    const chatService = new ChatService({
      chat: {
        downloadHistoryMarkdown: downloadHistoryMarkdownMock,
        uploadHistoryMarkdown: saveChatHistoryMock,
      } as never,
      chatAttachments: {
        getAttachmentById: getAttachmentByIdMock,
      } as never,
      workItemService: {} as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      projectsRepository: {} as never,
      integrationsService: {} as never,
    });

    const loaded = await chatService.loadChatHistory('conv-1');

    expect(getAttachmentByIdMock).toHaveBeenCalledWith('att-expired-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.attachments?.[0]?.url).toBe(
      'https://storage.example.com/refreshed-url'
    );
    expect(
      new Date(loaded[0]?.attachments?.[0]?.expiresAt || 0).getTime()
    ).toBeGreaterThan(Date.now());
  });
});

describe('ChatService batch_import_work_items', () => {
  const mockProjectsRepo = {
    findById: vi
      .fn()
      .mockResolvedValue({ id: 'proj-1', key: 'ALICE', name: 'Alice Project' }),
    listAll: vi
      .fn()
      .mockResolvedValue([
        { id: 'proj-1', key: 'ALICE', name: 'Alice Project' },
      ]),
  };

  it('fails atomically before DB creation when hierarchy has children under Issue and skipInvalidHierarchy is false', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([]);
    const createWorkItemMock = vi.fn();

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: createWorkItemMock } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const items = [
      {
        temporaryIdentifier: 'item-bug-1',
        title: 'Fix Profile Bug',
        type: WorkItemTypeEnum.Issue,
        children: [
          {
            temporaryIdentifier: 'item-task-1',
            title: 'Subtask under bug',
            type: WorkItemTypeEnum.Task,
          },
        ],
      },
    ];

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
              skipInvalidHierarchy: false,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      error?: string;
    };
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Parent of type Issue cannot have subtasks');
    expect(result.error).toContain('no work items were created');
    expect(createWorkItemMock).not.toHaveBeenCalled();
    expect(toolActionsPerformed).toHaveLength(0);
  });

  it('imports valid items and skips invalid subtasks when skipInvalidHierarchy is true', async () => {
    let createdCounter = 0;
    const createWorkItemMock = vi.fn().mockImplementation((_userId, body) => {
      createdCounter++;
      return Promise.resolve({
        id: `created-uuid-${createdCounter}`,
        title: body.title,
        key: 'ALICE-1',
      });
    });

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: createWorkItemMock } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const items = [
      {
        temporaryIdentifier: 'epic-1',
        title: 'Notification System',
        type: WorkItemTypeEnum.Epic,
      },
      {
        temporaryIdentifier: 'bug-1',
        title: 'Fix Login Crash',
        type: WorkItemTypeEnum.Issue,
        children: [
          {
            temporaryIdentifier: 'task-1',
            title: 'Subtask under bug',
            type: WorkItemTypeEnum.Task,
          },
        ],
      },
    ];

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
              skipInvalidHierarchy: true,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      importedCount: number;
      skippedCount: number;
      skippedItems: Array<{ title: string; reason: string }>;
    };

    expect(result.importedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.skippedItems[0]?.title).toBe('Subtask under bug');
    expect(result.skippedItems[0]?.reason).toContain(
      'Parent of type Issue cannot have subtasks'
    );
    expect(toolActionsPerformed).toHaveLength(2);
    expect(toolActionsPerformed.map((a) => a.entity.title)).toEqual([
      'Notification System',
      'Fix Login Crash',
    ]);
  });

  it('performs atomic rollback and cleans up created items when an error occurs midway', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([]);
    vi.mocked(prisma.work_items.deleteMany).mockResolvedValue({ count: 1 });

    const createWorkItemMock = vi
      .fn()
      .mockResolvedValueOnce({ id: 'created-item-1', title: 'First Task' })
      .mockRejectedValueOnce(new Error('Unexpected database failure'));

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: createWorkItemMock } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const items = [
      {
        temporaryIdentifier: 't-1',
        title: 'First Task',
        type: WorkItemTypeEnum.Task,
      },
      {
        temporaryIdentifier: 't-2',
        title: 'Second Task',
        type: WorkItemTypeEnum.Task,
      },
    ];

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: { projectId: 'proj-1', items },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      error?: string;
    };
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Unexpected database failure');
    expect(result.error).toContain('All changes were rolled back');

    // Verify rollback called deleteMany with the id of the first created item
    expect(prisma.work_items.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['created-item-1'] } },
    });
    // Verify toolActionsPerformed was reverted back to empty
    expect(toolActionsPerformed).toHaveLength(0);
  });

  it('updates existing items and their hierarchy without creating duplicates on file update', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([
      {
        id: 'existing-story-id',
        title: 'Design UI',
        jira_issue_key: 'ALICE-001',
        type: WorkItemTypeEnum.Story,
        status: 'New',
        parent_id: 'old-epic-id',
        priority: 'low',
      } as never,
      {
        id: 'new-parent-feature-id',
        title: 'Feature Container',
        jira_issue_key: 'ALICE-002',
        type: WorkItemTypeEnum.Feature,
        status: 'New',
        parent_id: null,
        priority: 'medium',
      } as never,
    ]);
    vi.mocked(prisma.work_items.update).mockResolvedValue({} as never);

    const createWorkItemMock = vi.fn();
    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: createWorkItemMock } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const items = [
      {
        temporaryIdentifier: 'new-parent-feature-id',
        title: 'Feature Container',
        type: WorkItemTypeEnum.Feature,
        children: [
          {
            temporaryIdentifier: 'existing-story-id',
            title: 'Design UI',
            type: WorkItemTypeEnum.Story,
            priority: 'high',
          },
        ],
      },
    ];

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
              updateExisting: true,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      updatedCount: number;
      createdCount: number;
      updatedItems: Array<{ id: string; key: string; title: string }>;
    };

    expect(result.createdCount).toBe(0);
    expect(result.updatedCount).toBe(2);
    expect(createWorkItemMock).not.toHaveBeenCalled();
    expect(prisma.work_items.update).toHaveBeenCalled();
    expect(toolActionsPerformed).toHaveLength(2);
    expect(toolActionsPerformed[0]?.type).toBe('update_work_item');
    expect(toolActionsPerformed[1]?.type).toBe('update_work_item');
  });

  it('identifies omitted items and retains them in the backlog without deleting via chat', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([
      {
        id: 'item-to-keep',
        title: 'Keep Item',
        jira_issue_key: 'ALICE-1',
        type: WorkItemTypeEnum.Story,
        status: 'New',
        parent_id: null,
        priority: 'medium',
      } as never,
      {
        id: 'item-to-remove',
        title: 'Omitted Item',
        jira_issue_key: 'ALICE-2',
        type: WorkItemTypeEnum.Story,
        status: 'New',
        parent_id: null,
        priority: 'medium',
      } as never,
    ]);
    vi.mocked(prisma.work_items.update).mockResolvedValue({} as never);

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: vi.fn() } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const items = [
      {
        temporaryIdentifier: 'item-to-keep',
        title: 'Keep Item',
        type: WorkItemTypeEnum.Story,
      },
    ];

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
              updateExisting: true,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      updatedCount: number;
      omittedCount: number;
      omittedItems: Array<{ id: string; key: string; title: string }>;
      omittedNotice?: string;
    };

    expect(result.updatedCount).toBe(1);
    expect(result.omittedCount).toBe(1);
    expect(result.omittedItems[0]?.title).toBe('Omitted Item');
    expect(result.omittedNotice).toContain(
      'Deletion of work items is not allowed via Alice chat'
    );
    expect(prisma.work_items.updateMany).not.toHaveBeenCalled();
    expect(toolActionsPerformed).not.toContainEqual(
      expect.objectContaining({
        type: 'delete_work_item',
      })
    );
  });

  it('updates hierarchy when parent changes in updated items during batch import', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([
      {
        id: 'parent-1',
        title: 'Parent Epic',
        jira_issue_key: 'ALICE-1',
        type: WorkItemTypeEnum.Epic,
        status: 'New',
        parent_id: null,
        priority: 'medium',
      } as never,
      {
        id: 'child-1',
        title: 'Child Task',
        jira_issue_key: 'ALICE-2',
        type: WorkItemTypeEnum.Task,
        status: 'New',
        parent_id: null,
        priority: 'medium',
      } as never,
    ]);
    vi.mocked(prisma.work_items.update).mockResolvedValue({} as never);

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: vi.fn() } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const items = [
      {
        temporaryIdentifier: 'epic-1',
        title: 'Parent Epic',
        jiraIssueKey: 'ALICE-1',
        type: WorkItemTypeEnum.Epic,
      },
      {
        temporaryIdentifier: 'task-1',
        title: 'Child Task',
        jiraIssueKey: 'ALICE-2',
        type: WorkItemTypeEnum.Task,
        parentReference: 'Parent Epic',
      },
    ];

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
              updateExisting: true,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      updatedCount: number;
      hierarchyUpdatedCount: number;
      hierarchyUpdates: Array<{
        title: string;
        oldParentTitle: string;
        newParentTitle: string;
      }>;
    };

    expect(result.updatedCount).toBe(2);
    expect(result.hierarchyUpdatedCount).toBe(1);
    expect(result.hierarchyUpdates[0]?.title).toBe('Child Task');
    expect(result.hierarchyUpdates[0]?.oldParentTitle).toBe('Root (No parent)');
    expect(result.hierarchyUpdates[0]?.newParentTitle).toBe('Parent Epic');
    expect(prisma.work_items.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'child-1' },
        data: expect.objectContaining({ parent_id: 'parent-1' }),
      })
    );
  });

  it('imports and updates work items with hierarchy and dynamic fields from CSV files', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([
      {
        id: 'uuid-epic-1',
        title: 'Core Infrastructure',
        jira_issue_key: 'ALICE-1',
        type: WorkItemTypeEnum.Epic,
        status: 'In Progress',
        parent_id: null,
        priority: 'medium',
      } as never,
      {
        id: 'uuid-feature-2',
        title: 'Authentication Service',
        jira_issue_key: 'ALICE-2',
        type: WorkItemTypeEnum.Feature,
        status: 'New',
        parent_id: null,
        priority: 'medium',
      } as never,
    ]);
    vi.mocked(prisma.work_items.update).mockResolvedValue({} as never);

    let createdCounter = 0;
    const createWorkItemMock = vi.fn().mockImplementation((_userId, body) => {
      createdCounter++;
      return Promise.resolve({
        id: `uuid-created-${createdCounter}`,
        title: body.title,
        key: `ALICE-${createdCounter + 2}`,
      });
    });

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: createWorkItemMock } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const csvContent = `Issue key,Type,Title,Parent,Priority,Description,Dept
ALICE-1,Epic,Core Infrastructure,,highest,Updated infra description,Platform
ALICE-2,Feature,Authentication Service,ALICE-1,high,Updated auth description,Security
,Story,Login Endpoint,ALICE-2,medium,Build login handler,Security`;

    const items = parseDelimitedWorkItemDocument(csvContent);
    expect(items).toHaveLength(3);

    const toolActionsPerformed: ToolAction[] = [];
    const parts = await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
              updateExisting: true,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    const result = parts[0]?.functionResponse?.response?.result as {
      importedCount: number;
      updatedCount: number;
    };

    expect(result.updatedCount).toBe(2);
    expect(result.importedCount).toBe(1);

    // Verify ALICE-2 was updated with parent_id: uuid-epic-1
    expect(prisma.work_items.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uuid-feature-2' },
        data: expect.objectContaining({
          parent_id: 'uuid-epic-1',
          priority: 'high',
        }),
      })
    );

    // Verify ALICE-3 (new Story) was created with parent_id: uuid-feature-2
    expect(createWorkItemMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Login Endpoint',
        type: WorkItemTypeEnum.Story,
        parent_id: 'uuid-feature-2',
      })
    );

    expect(toolActionsPerformed).toContainEqual(
      expect.objectContaining({
        type: 'update_work_item',
        entity: expect.objectContaining({ key: 'ALICE-1' }),
      })
    );
    expect(toolActionsPerformed).toContainEqual(
      expect.objectContaining({
        type: 'create_work_item',
        entity: expect.objectContaining({ title: 'Login Endpoint' }),
      })
    );
  });

  it('imports and links work item hierarchy from Markdown tables and text outlines', async () => {
    vi.mocked(prisma.work_items.findMany).mockResolvedValue([]);
    let createdCounter = 0;
    const createWorkItemMock = vi.fn().mockImplementation((_userId, body) => {
      createdCounter++;
      return Promise.resolve({
        id: `created-uuid-${createdCounter}`,
        title: body.title,
        key: `ALICE-${createdCounter}`,
      });
    });

    const chatService = new ChatService({
      chat: {} as never,
      projectsRepository: mockProjectsRepo as never,
      workItemService: { createWorkItem: createWorkItemMock } as never,
      sprintsService: {} as never,
      projectsService: {} as never,
      integrationsService: {} as never,
    });

    const mdTable = `| Type | Title | Priority | Parent | CostCenter |
| --- | --- | --- | --- | --- |
| Epic | Payment Engine | high | | CC-99 |
| Feature | Checkout API | high | Payment Engine | CC-99 |
| Story | Webhook Handler | medium | Checkout API | CC-99 |`;

    const items = parseMarkdownTableWorkItemDocument(mdTable);
    const toolActionsPerformed: ToolAction[] = [];

    await chatService.processFunctionCalls(
      'user-1',
      [
        {
          functionCall: {
            name: 'batch_import_work_items',
            args: {
              projectId: 'proj-1',
              items,
            },
          },
        },
      ],
      toolActionsPerformed
    );

    expect(createWorkItemMock).toHaveBeenCalledTimes(3);
    // Verify first item created without parent
    expect(createWorkItemMock).toHaveBeenNthCalledWith(
      1,
      'user-1',
      expect.objectContaining({
        title: 'Payment Engine',
        type: WorkItemTypeEnum.Epic,
        parent_id: null,
      })
    );
    // Verify second item created with first item's id as parent
    expect(createWorkItemMock).toHaveBeenNthCalledWith(
      2,
      'user-1',
      expect.objectContaining({
        title: 'Checkout API',
        type: WorkItemTypeEnum.Feature,
        parent_id: 'created-uuid-1',
      })
    );
    // Verify third item created with second item's id as parent
    expect(createWorkItemMock).toHaveBeenNthCalledWith(
      3,
      'user-1',
      expect.objectContaining({
        title: 'Webhook Handler',
        type: WorkItemTypeEnum.Story,
        parent_id: 'created-uuid-2',
      })
    );
    expect(toolActionsPerformed).toHaveLength(3);
  });
});
