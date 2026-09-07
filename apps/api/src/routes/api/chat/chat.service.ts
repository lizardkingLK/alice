import {
  getRoleName,
  WorkItemTypeEnum,
  DEFAULT_WORK_ITEM_PRIORITY,
  WORK_ITEM_PRIORITIES,
  ProjectStatusEnum,
  mapToWorkItemType,
  ChatRoles,
  ChatTurnRoles,
  toChatTurnRole,
  getAllowedChildType,
  ChatAttachmentFileTypeEnum,
  type ParsedWorkItemNode,
} from '@repo/types';
import type { WorkItemService } from '../workItems/workItems.service';
import type { SprintsService } from '../sprints/sprints.service';
import type { ProjectsService } from '../projects/projects.service';
import type { ProjectsRepository } from '../projects/projects.repository';
import type { ProjectRowWithOwner } from '../projects/projects.types';
import type { IntegrationsService } from '../integrations/integrations.service';
import type { ResolvedChatModelConfig } from '../integrations/chat-providers/chat-provider.types';
import { resolveChatProvider } from '../integrations/chat-providers/resolve-chat-provider';
import { systemInstruction, aliceChatTools } from './chat.route.data';
import type { ChatRepository } from './chat.repository';
import { ChatAttachmentsRepository } from './chat-attachments.repository';
import { fetchAndParseWorkItemAttachment } from './chat-attachment-parser';
import { WorkItemDeduplicationAgent } from './work-item-deduplication.agent';
import { sanitizeLog } from './chat.utils';
import { prisma } from '../../../lib/prisma';
import { supabase } from '../../../lib/supabase';
import type {
  ChatContentPart,
  ChatContentTurn,
  ChatLlmResponse,
  ToolAction,
  StoredChatMessage,
} from './chat.route.types';

export { sanitizeLog } from './chat.utils';

export type ChatServiceDeps = {
  chat: ChatRepository;
  chatAttachments?: ChatAttachmentsRepository;
  deduplicationAgent?: WorkItemDeduplicationAgent;
  workItemService: Pick<WorkItemService, 'createWorkItem'>;
  sprintsService: Pick<SprintsService, 'createSprint'>;
  projectsService: Pick<ProjectsService, 'createProject'>;
  projectsRepository: Pick<ProjectsRepository, 'listAll' | 'findById'>;
  integrationsService: Pick<IntegrationsService, 'resolveChatModelForChat'>;
};

function textToProseMirrorJson(
  text: string | null | undefined,
  dynamicFields?: Record<string, unknown>
) {
  if (!text && (!dynamicFields || Object.keys(dynamicFields).length === 0)) {
    return null;
  }
  const paragraphs: Array<{
    type: string;
    content: Array<{ type: string; text: string }>;
  }> = [];

  if (text) {
    paragraphs.push({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    });
  }

  if (dynamicFields && Object.keys(dynamicFields).length > 0) {
    const formattedFields = Object.entries(dynamicFields)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`
      )
      .join('\n');
    paragraphs.push({
      type: 'paragraph',
      content: [{ type: 'text', text: `[Dynamic Fields]\n${formattedFields}` }],
    });
  }

  return {
    type: 'doc',
    content: paragraphs,
  };
}

/**
 * Converts messages array to a Markdown string with JSON metadata embedded.
 */
export function chatHistoryToMarkdown(
  conversationId: string,
  messages: StoredChatMessage[]
): string {
  const jsonStr = JSON.stringify(messages);
  let md = `# Chat History for Conversation: ${conversationId}\n\n`;
  md += `<!-- JSON_HISTORY_DATA_START\n${jsonStr}\nJSON_HISTORY_DATA_END -->\n\n`;

  for (const msg of messages) {
    md += `### ${getRoleName(msg.role)}\n\n${msg.content || ''}\n\n`;
    if (msg.attachments?.length) {
      md += `*Attached Files:*\n`;
      for (const att of msg.attachments) {
        md += `- [${att.fileName}](${att.url}) (${att.fileType})\n`;
      }
      md += `\n`;
    }
    if (msg.actions?.length) {
      md += `*Executed Actions:*\n`;
      for (const act of msg.actions) {
        md += `- **${act.type}**: ${JSON.stringify(act.entity)}\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  }

  return md;
}

/**
 * Extracts and parses the JSON messages array from a Markdown string.
 */
export function markdownToChatHistory(md: string): StoredChatMessage[] {
  const startMarker = '<!-- JSON_HISTORY_DATA_START';
  const endMarker = 'JSON_HISTORY_DATA_END -->';

  const startIndex = md.indexOf(startMarker);
  const endIndex = md.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return [];
  }

  const jsonStr = md.slice(startIndex + startMarker.length, endIndex).trim();
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(
      'Failed to parse chat history JSON from markdown:',
      sanitizeLog(error)
    );
    return [];
  }
}

export class ChatService {
  private readonly historyCache = new Map<string, StoredChatMessage[]>();
  private readonly chatAttachmentsRepository: ChatAttachmentsRepository;
  private readonly deduplicationAgent: WorkItemDeduplicationAgent;

  constructor(private readonly deps: ChatServiceDeps) {
    this.chatAttachmentsRepository =
      deps.chatAttachments ?? new ChatAttachmentsRepository(supabase);
    this.deduplicationAgent =
      deps.deduplicationAgent ?? new WorkItemDeduplicationAgent();
  }

  private get chat() {
    return this.deps.chat;
  }

  get chatAttachments(): ChatAttachmentsRepository {
    return this.chatAttachmentsRepository;
  }

  resolveChatModelForChat(params: {
    integrationId?: string;
    legacyModelId?: string;
  }): Promise<ResolvedChatModelConfig> {
    return this.deps.integrationsService.resolveChatModelForChat(params);
  }

  async callChatModelAPI(
    chatModel: ResolvedChatModelConfig,
    contents: ChatContentTurn[],
    contextInstruction: string
  ): Promise<ChatLlmResponse> {
    const provider = resolveChatProvider(chatModel.provider);
    return provider.generateWithTools({
      apiKey: chatModel.apiKey,
      apiUrl: chatModel.apiUrl,
      model: chatModel.model,
      contents,
      systemInstruction: systemInstruction + '\n' + contextInstruction,
      tools: aliceChatTools,
    });
  }

  async processFunctionCalls(
    userId: string,
    functionCalls: ChatContentPart[],
    toolActionsPerformed: ToolAction[]
  ): Promise<ChatContentPart[]> {
    const functionResponseParts: ChatContentPart[] = [];
    for (const call of functionCalls) {
      if (!call.functionCall) continue;
      const { name, args } = call.functionCall;
      let result: unknown;

      try {
        result = await this.executeTool(
          userId,
          name,
          args || {},
          toolActionsPerformed
        );
      } catch (err: unknown) {
        console.error(`Error executing tool ${sanitizeLog(name)}`);
        result = {
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }

      functionResponseParts.push({
        functionResponse: {
          name,
          response: { result },
        },
      });
    }
    return functionResponseParts;
  }

  private async executeTool(
    userId: string,
    name: string,
    args: Record<string, unknown>,
    toolActionsPerformed: ToolAction[]
  ): Promise<unknown> {
    const toolHandlers: Record<string, () => Promise<unknown>> = {
      list_projects: () => this.handleListProjects(),
      create_project: () =>
        this.handleCreateProject(userId, args, toolActionsPerformed),
      list_sprints: () => this.handleListSprints(args),
      create_sprint: () =>
        this.handleCreateSprint(userId, args, toolActionsPerformed),
      list_users: () => this.chat.listUsersSnapshot(),
      create_work_item: () =>
        this.handleCreateWorkItem(userId, args, toolActionsPerformed),
      parse_work_item_attachment: () =>
        this.handleParseWorkItemAttachment(args),
      check_work_item_duplicates: () =>
        this.handleCheckWorkItemDuplicates(args),
      batch_import_work_items: () =>
        this.handleBatchImportWorkItems(
          userId,
          args,
          toolActionsPerformed
        ),
    };

    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown function: ${name}`);
    }

    return handler();
  }

  private async handleListProjects(): Promise<unknown> {
    const projects = await this.deps.projectsRepository.listAll();
    return projects.map((p) => ({ id: p.id, name: p.name, key: p.key }));
  }

  private async handleCreateProject(
    userId: string,
    args: Record<string, unknown>,
    toolActionsPerformed: ToolAction[]
  ): Promise<unknown> {
    const projName = typeof args.name === 'string' ? args.name : '';
    const projKey = typeof args.key === 'string' ? args.key : '';
    const description =
      typeof args.description === 'string' ? args.description : null;
    const project = await this.deps.projectsService.createProject(userId, {
      name: projName,
      key: projKey.toUpperCase(),
      description,
      status: ProjectStatusEnum.active,
      start_date: null,
      end_date: null,
      owner_id: userId,
      jira_project_key: null,
      jira_connection_id: null,
      github_repo: null,
      github_token: null,
    });
    const result = { id: project.id, name: project.name, key: project.key };
    toolActionsPerformed.push({ type: 'create_project', entity: result });
    return result;
  }

  private async handleListSprints(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const projectId = typeof args.projectId === 'string' ? args.projectId : '';
    const rows = await this.chat.listSprintsByProject(projectId);
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      start_date: s.start_date,
      end_date: s.end_date,
    }));
  }

  private async handleCreateSprint(
    userId: string,
    args: Record<string, unknown>,
    toolActionsPerformed: ToolAction[]
  ): Promise<unknown> {
    const sprintName = typeof args.name === 'string' ? args.name : '';
    const projectId = typeof args.projectId === 'string' ? args.projectId : '';
    const startDate =
      typeof args.startDate === 'string'
        ? args.startDate
        : new Date().toISOString().split('T')[0] || '';
    const endDate =
      typeof args.endDate === 'string'
        ? args.endDate
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0] || '';
    const sprint = await this.deps.sprintsService.createSprint(userId, {
      name: sprintName,
      goal: '',
      projectId,
      startDate,
      endDate,
    });
    const result = { id: sprint.id, name: sprint.name, status: sprint.status };
    toolActionsPerformed.push({ type: 'create_sprint', entity: result });
    return result;
  }

  private async handleCreateWorkItem(
    userId: string,
    args: Record<string, unknown>,
    toolActionsPerformed: ToolAction[]
  ): Promise<unknown> {
    const title = typeof args.title === 'string' ? args.title : '';
    const projectId = typeof args.projectId === 'string' ? args.projectId : '';
    const sprintId = typeof args.sprintId === 'string' ? args.sprintId : null;
    const assigneeId =
      typeof args.assigneeId === 'string' ? args.assigneeId : null;

    const typeValue =
      typeof args.type === 'string'
        ? mapToWorkItemType(args.type)
        : WorkItemTypeEnum.Task;

    const rawPriority =
      typeof args.priority === 'string'
        ? args.priority
        : DEFAULT_WORK_ITEM_PRIORITY;
    const priorityValue = (WORK_ITEM_PRIORITIES as readonly string[]).includes(
      rawPriority
    )
      ? (rawPriority as (typeof WORK_ITEM_PRIORITIES)[number])
      : DEFAULT_WORK_ITEM_PRIORITY;
    const description =
      typeof args.description === 'string' ? args.description : null;

    const workItem = await this.deps.workItemService.createWorkItem(userId, {
      title,
      project_id: projectId,
      sprint_id: sprintId,
      assignee_id: assigneeId,
      type: typeValue,
      priority: priorityValue,
      description: textToProseMirrorJson(description),
      due_date: null,
    });
    const project = await this.deps.projectsRepository.findById(projectId);
    const projectKey = project?.key || 'TASK';
    const workItemKey = `${projectKey}-${workItem.id.slice(0, 4).toUpperCase()}`;
    const result = { id: workItem.id, key: workItemKey, title: workItem.title };
    toolActionsPerformed.push({ type: 'create_work_item', entity: result });
    return result;
  }

  private async handleParseWorkItemAttachment(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const attachmentUrl =
      typeof args.attachmentUrl === 'string' ? args.attachmentUrl : '';
    const fileName =
      typeof args.fileName === 'string' ? args.fileName : 'attachment';

    if (!attachmentUrl) {
      throw new Error('attachmentUrl is required');
    }

    const { items, summary } = await fetchAndParseWorkItemAttachment(
      attachmentUrl,
      fileName,
      ChatAttachmentFileTypeEnum.Other
    );

    return {
      summary,
      totalItemsFound: items.length,
      items,
    };
  }

  private async handleCheckWorkItemDuplicates(
    args: Record<string, unknown>
  ): Promise<unknown> {
    const projectId =
      typeof args.projectId === 'string' ? args.projectId : '';
    if (!projectId) {
      throw new Error('projectId is required');
    }

    let itemsToAnalyze: ParsedWorkItemNode[] = [];
    if (typeof args.attachmentUrl === 'string' && args.attachmentUrl) {
      const parsed = await fetchAndParseWorkItemAttachment(
        args.attachmentUrl,
        'attachment',
        ChatAttachmentFileTypeEnum.Other
      );
      itemsToAnalyze = parsed.items;
    }

    const report = await this.deduplicationAgent.inspectAndDeduplicate(
      projectId,
      itemsToAnalyze
    );

    return report;
  }

  private async handleBatchImportWorkItems(
    userId: string,
    args: Record<string, unknown>,
    toolActionsPerformed: ToolAction[]
  ): Promise<unknown> {
    const projectId =
      typeof args.projectId === 'string' ? args.projectId : '';
    const sprintId =
      typeof args.sprintId === 'string' ? args.sprintId : null;
    const attachmentUrl =
      typeof args.attachmentUrl === 'string' ? args.attachmentUrl : '';

    if (!projectId) {
      throw new Error('projectId is required');
    }
    if (!attachmentUrl) {
      throw new Error('attachmentUrl is required');
    }

    const { items } = await fetchAndParseWorkItemAttachment(
      attachmentUrl,
      'attachment',
      ChatAttachmentFileTypeEnum.Other
    );

    const project = await this.deps.projectsRepository.findById(projectId);
    const projectKey = project?.key || 'TASK';

    const createdItems: Array<{ id: string; key: string; title: string }> = [];
    const idMapping = new Map<string, string>();

    const createSingleNode = async (
      node: ParsedWorkItemNode,
      resolvedParentId: string | null
    ) => {
      const typeValue = node.type || WorkItemTypeEnum.Task;
      const priorityValue = node.priority || DEFAULT_WORK_ITEM_PRIORITY;

      const created = await this.deps.workItemService.createWorkItem(userId, {
        title: node.title,
        project_id: projectId,
        sprint_id: sprintId,
        assignee_id: null,
        type: typeValue,
        priority: priorityValue,
        description: textToProseMirrorJson(node.description, node.dynamicFields),
        due_date: node.dueDate || null,
        parent_id: resolvedParentId,
        labels: node.labels,
        story_points: node.storyPoints ?? null,
        jira_issue_key: node.jiraIssueKey || null,
      });

      const workItemKey = `${projectKey}-${created.id.slice(0, 4).toUpperCase()}`;
      const summary = { id: created.id, key: workItemKey, title: created.title };
      createdItems.push(summary);
      toolActionsPerformed.push({ type: 'create_work_item', entity: summary });

      idMapping.set(node.temporaryIdentifier, created.id);
      idMapping.set(node.title.toLowerCase().trim(), created.id);

      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const allowedChildType = getAllowedChildType(typeValue);
          const effectiveChildNode: ParsedWorkItemNode = {
            ...child,
            type: allowedChildType || child.type,
          };
          await createSingleNode(effectiveChildNode, created.id);
        }
      }
    };

    for (const item of items) {
      if (!item.parentReference) {
        await createSingleNode(item, null);
      }
    }

    for (const item of items) {
      if (item.parentReference && !idMapping.has(item.temporaryIdentifier)) {
        const parentId =
          idMapping.get(item.parentReference) ||
          idMapping.get(item.parentReference.toLowerCase().trim()) ||
          null;
        await createSingleNode(item, parentId);
      }
    }

    return {
      importedCount: createdItems.length,
      items: createdItems,
    };
  }

  async saveChatHistory(
    conversationId: string,
    messages: StoredChatMessage[]
  ): Promise<void> {
    // 1. Cache the history locally immediately
    this.historyCache.set(conversationId, messages);

    try {
      // 2. Touch the conversation record in the database immediately (fast DB query)
      await this.chat.touchConversationUpdatedAt(conversationId);

      // 3. Upload history to storage asynchronously in the background
      const mdContent = chatHistoryToMarkdown(conversationId, messages);
      this.chat
        .uploadHistoryMarkdown(conversationId, mdContent)
        .catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `Failed to upload chat history in background for conversation ${sanitizeLog(conversationId)}:`,
            sanitizeLog(msg)
          );
        });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to touch/save chat history for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(msg)
      );
    }
  }

  async loadChatHistory(conversationId: string): Promise<StoredChatMessage[]> {
    // 1. Check in-memory cache first
    const cached = this.historyCache.get(conversationId);
    if (cached) {
      return cached;
    }

    try {
      // 2. If not cached, fetch from storage and update cache
      const mdText = await this.chat.downloadHistoryMarkdown(conversationId);
      if (!mdText) return [];
      const messages = markdownToChatHistory(mdText);
      this.historyCache.set(conversationId, messages);
      return messages;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to load chat history for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(msg)
      );
      return [];
    }
  }

  async verifyConversationOwner(
    userId: string,
    conversationId: string
  ): Promise<boolean> {
    const conversation = await prisma.chat_conversations.findUnique({
      where: { id: conversationId },
      select: { user_id: true },
    });
    return conversation?.user_id === userId;
  }

  async listConversations(userId: string) {
    return this.chat.listConversations(userId);
  }

  async createConversation(
    userId: string,
    title = 'New Chat',
    isProcessing = false
  ): Promise<string> {
    return this.chat.createConversation(userId, title, isProcessing);
  }

  async setProcessingStatus(
    conversationId: string,
    isProcessing: boolean
  ): Promise<void> {
    await this.chat.setProcessingStatus(conversationId, isProcessing);
  }

  async notifyChatProcessed(options: {
    readonly userId: string;
    readonly message: string;
    readonly relatedItemId: string | null;
  }): Promise<void> {
    await prisma.notifications.create({
      data: {
        user_id: options.userId,
        type: 'chat_processed',
        message: options.message,
        related_item_id: options.relatedItemId,
        created_by: options.userId,
      },
    });
  }

  async deleteConversation(
    userId: string,
    conversationId: string
  ): Promise<void> {
    // Clear from in-memory cache
    this.historyCache.delete(conversationId);

    // Get the conversation title before deleting it
    const conversation = await prisma.chat_conversations
      .findUnique({
        where: { id: conversationId },
        select: { title: true },
      })
      .catch(() => null);
    const convTitle = conversation?.title || 'Chat';

    // Delete associated notifications in the database
    await prisma.notifications
      .deleteMany({
        where: {
          related_item_id: conversationId,
        },
      })
      .catch((err) => {
        console.error(
          `Failed to delete notifications for conversation ${sanitizeLog(conversationId)}:`,
          sanitizeLog(err)
        );
      });

    await this.chat.deleteConversation(userId, conversationId);

    // Create the deleted notification in database
    await this.notifyChatProcessed({
      userId,
      message: `Your chat "${convTitle}" has been deleted.`,
      relatedItemId: null,
    }).catch((err) => {
      console.error(
        `Failed to create delete notification for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(err)
      );
    });

    try {
      await this.chat.removeHistoryMarkdown(conversationId);
    } catch (err) {
      console.warn(
        `Failed to remove chat history file for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(err)
      );
    }
  }

  async loadWorkspaceContext() {
    const [users, activeSprints] = await Promise.all([
      this.chat.listUsersSnapshot(),
      this.chat.listActiveSprintsSnapshot(),
    ]);
    return { users, activeSprints };
  }

  async generateChatResponse(
    userId: string,
    history: StoredChatMessage[],
    chatModel: ResolvedChatModelConfig
  ): Promise<{ responseText: string; toolActionsPerformed: ToolAction[] }> {
    const contents: ChatContentTurn[] = history.map((msg) => {
      const role = toChatTurnRole(msg.role);
      const parts = [{ text: msg.content }];
      return { role, parts };
    });

    const [projectsRaw, workspace] = await Promise.all([
      this.deps.projectsRepository.listAll().catch(() => []),
      this.loadWorkspaceContext(),
    ]);

    const projects = (projectsRaw || []) as ProjectRowWithOwner[];
    const { users, activeSprints: sprints } = workspace;

    const lastUserMessage = [...history]
      .reverse()
      .find((m) => m.role === ChatRoles.User);
    let attachmentsInstruction = '';
    if (lastUserMessage?.attachments && lastUserMessage.attachments.length > 0) {
      const attachmentsList = lastUserMessage.attachments
        .map(
          (a) =>
            `- File: "${a.fileName}" (type: ${a.fileType}, URL: ${a.url})`
        )
        .join('\n');
      attachmentsInstruction = `
User Attached Documents in Current Request:
${attachmentsList}
You should access and parse these attachments using "parse_work_item_attachment".
`;
    }

    const contextInstruction = `
Current Workspace State:
- Active Projects: ${JSON.stringify(projects.map((p) => ({ id: p.id, name: p.name, key: p.key })))}
- System Users: ${JSON.stringify(users.map((u) => ({ id: u.id, name: u.name, email: u.email })))}
- Ongoing Sprints (Active Status Only): ${JSON.stringify(sprints.map((s) => ({ id: s.id, name: s.name, projectId: s.project_id })))}
${attachmentsInstruction}
`;

    let responseText = '';
    const toolActionsPerformed: ToolAction[] = [];
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      const llmResponse = await this.callChatModelAPI(
        chatModel,
        contents,
        contextInstruction
      );
      const candidate = llmResponse.candidates?.[0];
      const modelContent = candidate?.content;

      if (!modelContent) {
        throw new Error('No response content returned from chat provider');
      }

      contents.push(modelContent);

      const functionCalls = modelContent.parts?.filter(
        (p: ChatContentPart) => p.functionCall
      );
      if (!functionCalls || functionCalls.length === 0) {
        responseText =
          modelContent.parts
            ?.map((p: ChatContentPart) => p.text || '')
            .join('\n') || '';
        break;
      }

      const functionResponseParts = await this.processFunctionCalls(
        userId,
        functionCalls,
        toolActionsPerformed
      );
      contents.push({
        role: ChatTurnRoles.User,
        parts: functionResponseParts,
      });

      loopCount++;
    }

    return { responseText, toolActionsPerformed };
  }

  async processChatAsync(
    userId: string,
    conversationId: string,
    history: StoredChatMessage[],
    chatModel: ResolvedChatModelConfig
  ): Promise<void> {
    try {
      const { responseText, toolActionsPerformed } =
        await this.generateChatResponse(userId, history, chatModel);

      const newAssistantMessage: StoredChatMessage = {
        id: `msg-${Date.now()}`,
        role: ChatRoles.Assistant,
        content: responseText,
        actions: toolActionsPerformed,
      };

      const updatedMessages = [...history, newAssistantMessage];
      await this.saveChatHistory(conversationId, updatedMessages);

      const conversation = await prisma.chat_conversations.findUnique({
        where: { id: conversationId },
        select: { title: true },
      });
      const convTitle = conversation?.title || 'Chat';

      await this.notifyChatProcessed({
        userId,
        message: `Your request in "${convTitle}" has been processed.`,
        relatedItemId: conversationId,
      });
    } catch (error: unknown) {
      console.error('Failed to process chat asynchronously:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      const errorAssistantMessage: StoredChatMessage = {
        id: `msg-${Date.now()}`,
        role: ChatRoles.Assistant,
        content: `Error: Failed to process your request. ${errMsg}`,
        actions: [],
      };
      await this.saveChatHistory(conversationId, [
        ...history,
        errorAssistantMessage,
      ]).catch(() => {});

      await this.notifyChatProcessed({
        userId,
        message: `Your chat request failed to process.`,
        relatedItemId: conversationId,
      }).catch(() => {});
    } finally {
      await this.chat
        .setProcessingStatus(conversationId, false)
        .catch((err) => {
          console.error('Failed to reset processing status:', err);
        });
    }
  }
}
