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
  ProjectFieldsConfigSchema,
  type ProjectFieldsConfig,
  ChatTurnRoleEnum,
  type WorkItemPriority,
  type WorkItemType,
} from '@repo/types';
import type { WorkItemService } from '../workItems/workItems.service';
import type { SprintsService } from '../sprints/sprints.service';
import type { ProjectsService } from '../projects/projects.service';
import type { ProjectsRepository } from '../projects/projects.repository';
import type { ProjectRowWithOwner } from '../projects/projects.types';
import type { IntegrationsService } from '../integrations/integrations.service';
import type { ResolvedChatModelConfig } from '../integrations/chat-providers/chat-provider.types';
import { resolveChatProvider } from '../integrations/chat-providers/resolve-chat-provider';
import {
  systemInstruction,
  aliceChatTools,
  dynamicFieldsSystemPrompt,
} from './chat.route.data';
import type { ChatRepository } from './chat.repository';
import { ChatAttachmentsRepository } from './chat-attachments.repository';
import { fetchAndParseWorkItemAttachment } from './chat-attachment-parser';
import { WorkItemDeduplicationAgent } from './work-item-deduplication.agent';
import { sanitizeLog } from './chat.utils';
import { prisma } from '../../../lib/prisma';
import { Prisma } from '@repo/types/prisma';
import { prismaAuditUpdate } from '../../../lib/prisma-audit';
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

function serializeDynamicFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

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
      .map(([key, value]) => `${key}: ${serializeDynamicFieldValue(value)}`)
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

function parseFieldProperty(
  rawField: unknown
): { key: string; prop: Record<string, unknown> } | null {
  if (!rawField || typeof rawField !== 'object') return null;
  const f = rawField as Record<string, unknown>;
  const key = typeof f.key === 'string' ? f.key.trim() : '';
  if (!key) return null;

  const prop: Record<string, unknown> = {
    type: typeof f.type === 'string' ? f.type : 'string',
    title: typeof f.title === 'string' ? f.title : key,
    ...(typeof f.description === 'string' && f.description
      ? { description: f.description }
      : {}),
    ...(Array.isArray(f.enum) && f.enum.length > 0 ? { enum: f.enum } : {}),
    ...(typeof f.format === 'string' && f.format ? { format: f.format } : {}),
    ...(f.type === 'array' && f.items ? { items: f.items } : {}),
  };
  return { key, prop };
}

function extractJsonFromText(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, '')
    .replaceAll('```', '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(
      'AI could not generate a valid JSON schema for the given request.'
    );
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function buildSchemaFromRawFields(rawFields: unknown[]): {
  $schema: string;
  type: 'object';
  properties: Record<string, unknown>;
  additionalProperties: true;
} {
  const properties: Record<string, unknown> = {};
  for (const field of rawFields) {
    const parsed = parseFieldProperty(field);
    if (parsed) {
      properties[parsed.key] = parsed.prop;
    }
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    additionalProperties: true,
  };
}

function tryExtractToolCallSchema(
  parts: ChatContentPart[]
): ProjectFieldsConfig | null {
  for (const part of parts) {
    if (
      part.functionCall?.name === 'generate_project_fields_schema' &&
      part.functionCall.args
    ) {
      const rawFields = Array.isArray(part.functionCall.args.fields)
        ? part.functionCall.args.fields
        : [];
      const schema = buildSchemaFromRawFields(rawFields);
      const validated = ProjectFieldsConfigSchema.safeParse(schema);
      if (validated.success) return validated.data;
    }
  }
  return null;
}

function mergeWithCurrentSchema(
  generatedSchema: ProjectFieldsConfig,
  currentSchema?: unknown
): ProjectFieldsConfig {
  if (
    !currentSchema ||
    typeof currentSchema !== 'object' ||
    !('properties' in currentSchema) ||
    !currentSchema.properties ||
    typeof currentSchema.properties !== 'object'
  ) {
    return generatedSchema;
  }

  const merged = {
    ...generatedSchema,
    properties: {
      ...(currentSchema.properties as Record<string, unknown>),
      ...generatedSchema.properties,
    },
  };

  const validated = ProjectFieldsConfigSchema.safeParse(merged);
  if (validated.success) {
    return validated.data;
  }

  return generatedSchema;
}

function detectCircularReference(
  item: ParsedWorkItemNode,
  flatNodeMap: Map<string, ParsedWorkItemNode>
): boolean {
  let curr: ParsedWorkItemNode | undefined =
    flatNodeMap.get(item.parentReference || '') ||
    flatNodeMap.get((item.parentReference || '').toLowerCase().trim());
  const visited = new Set<string>();
  const selfKey = item.temporaryIdentifier || item.title.toLowerCase().trim();

  while (curr?.parentReference) {
    const currKey = curr.temporaryIdentifier || curr.title.toLowerCase().trim();
    if (visited.has(currKey) || currKey === selfKey) {
      return true;
    }
    visited.add(currKey);
    curr =
      flatNodeMap.get(curr.parentReference) ||
      flatNodeMap.get(curr.parentReference.toLowerCase().trim());
  }

  return false;
}

function collectSkippedChildren(
  children: ParsedWorkItemNode[],
  parentType: string,
  skippedItems: Array<{ title: string; reason: string }>
): void {
  for (const child of children) {
    skippedItems.push({
      title: child.title,
      reason: `Parent of type ${parentType} cannot have subtasks`,
    });
    if (child.children && child.children.length > 0) {
      collectSkippedChildren(child.children, parentType, skippedItems);
    }
  }
}

function validateAndPruneTreeNode(
  node: ParsedWorkItemNode,
  options: { skipInvalidHierarchy?: boolean },
  skippedItems: Array<{ title: string; reason: string }>
): ParsedWorkItemNode | null {
  const typeValue = (node.type || WorkItemTypeEnum.Task) as WorkItemType;
  const allowedChildType = getAllowedChildType(typeValue);

  if (!node.children || node.children.length === 0) {
    return { ...node };
  }

  if (!allowedChildType) {
    if (!options.skipInvalidHierarchy) {
      throw new Error(
        `Parent of type ${typeValue} cannot have subtasks (found on "${node.title}"). Import aborted; no work items were created.`
      );
    }
    collectSkippedChildren(node.children, typeValue, skippedItems);
    return { ...node, children: undefined };
  }

  const validChildren: ParsedWorkItemNode[] = [];
  for (const child of node.children) {
    const effectiveChild: ParsedWorkItemNode = {
      ...child,
      type: allowedChildType || child.type,
    };
    const processed = validateAndPruneTreeNode(
      effectiveChild,
      options,
      skippedItems
    );
    if (processed) {
      validChildren.push(processed);
    }
  }

  return {
    ...node,
    children: validChildren.length > 0 ? validChildren : undefined,
  };
}

function isFlatItemHierarchyValid(
  item: ParsedWorkItemNode,
  flatNodeMap: Map<string, ParsedWorkItemNode>,
  options: { skipInvalidHierarchy?: boolean },
  skippedItems: Array<{ title: string; reason: string }>
): boolean {
  if (!item.parentReference) return true;

  const parentNode =
    flatNodeMap.get(item.parentReference) ||
    flatNodeMap.get(item.parentReference.toLowerCase().trim()) ||
    flatNodeMap.get(item.parentReference.toUpperCase().trim());

  if (!parentNode) return true;

  if (detectCircularReference(item, flatNodeMap)) {
    if (!options.skipInvalidHierarchy) {
      throw new Error(
        `Circular parent reference detected in work items (item "${item.title}"). Import aborted; no work items were created.`
      );
    }
    skippedItems.push({
      title: item.title,
      reason: 'Circular parent reference detected',
    });
    return false;
  }

  const parentType = (parentNode.type || WorkItemTypeEnum.Task) as WorkItemType;
  const allowedChildType = getAllowedChildType(parentType);
  if (!allowedChildType) {
    if (!options.skipInvalidHierarchy) {
      throw new Error(
        `Parent of type ${parentType} cannot have subtasks (item "${item.title}" references parent "${parentNode.title}"). Import aborted; no work items were created.`
      );
    }
    skippedItems.push({
      title: item.title,
      reason: `Parent of type ${parentType} cannot have subtasks`,
    });
    return false;
  }

  return true;
}

interface ExistingWorkItemMatch {
  id: string;
  title: string;
  jira_issue_key: string | null;
  type: string;
  status: string;
  parent_id: string | null;
  priority: string;
}

function findExistingWorkItem(
  node: ParsedWorkItemNode,
  existingWorkItems: ExistingWorkItemMatch[],
  updateExisting: boolean
): ExistingWorkItemMatch | null {
  if (!updateExisting) return null;
  if (node.jiraIssueKey) {
    const byKey = existingWorkItems.find(
      (e) =>
        e.jira_issue_key?.toUpperCase() === node.jiraIssueKey?.toUpperCase()
    );
    if (byKey) return byKey;
  }
  if (node.temporaryIdentifier) {
    const byId = existingWorkItems.find(
      (e) =>
        e.id === node.temporaryIdentifier ||
        e.jira_issue_key?.toUpperCase() ===
          node.temporaryIdentifier.toUpperCase()
    );
    if (byId) return byId;
  }
  if (node.title) {
    const normalized = node.title.toLowerCase().trim();
    return (
      existingWorkItems.find(
        (e) => e.title.toLowerCase().trim() === normalized
      ) ?? null
    );
  }
  return null;
}

async function updateExistingWorkItemRecord(params: {
  userId: string;
  existingId: string;
  resolvedParentId: string | null;
  typeValue: WorkItemType;
  priorityValue: WorkItemPriority;
  node: ParsedWorkItemNode;
}): Promise<void> {
  const {
    userId,
    existingId,
    resolvedParentId,
    typeValue,
    priorityValue,
    node,
  } = params;

  await prisma.work_items.update({
    where: { id: existingId },
    data: {
      parent_id: resolvedParentId,
      type: typeValue,
      priority: priorityValue,
      ...(node.description != null
        ? {
            description: (textToProseMirrorJson(
              node.description,
              node.dynamicFields
            ) ?? Prisma.DbNull) as Prisma.InputJsonValue,
          }
        : {}),
      ...(node.dueDate ? { due_date: new Date(node.dueDate) } : {}),
      ...(node.storyPoints != null ? { story_points: node.storyPoints } : {}),
      ...(node.labels ? { labels: node.labels as Prisma.InputJsonValue } : {}),
      ...prismaAuditUpdate(userId),
    },
  });
}

function identifyOmittedWorkItems(params: {
  projectKey: string;
  existingWorkItems: ExistingWorkItemRecord[];
  matchedExistingIds: Set<string>;
}): Array<{ id: string; key: string; title: string }> {
  const { projectKey, existingWorkItems, matchedExistingIds } = params;
  const omittedExisting = existingWorkItems.filter(
    (e) => !matchedExistingIds.has(e.id)
  );
  return omittedExisting.map((omitted) => ({
    id: omitted.id,
    key:
      omitted.jira_issue_key ||
      `${projectKey}-${omitted.id.slice(0, 4).toUpperCase()}`,
    title: omitted.title,
  }));
}

async function rollbackBatchImport(params: {
  createdItemIds: string[];
  updatedOriginalStates: Array<{ id: string; parent_id: string | null }>;
  toolActionsPerformed: ToolAction[];
  initialActionCount: number;
  err: unknown;
}): Promise<never> {
  const {
    createdItemIds,
    updatedOriginalStates,
    toolActionsPerformed,
    initialActionCount,
    err,
  } = params;

  if (createdItemIds.length > 0) {
    try {
      await prisma.work_items.deleteMany({
        where: { id: { in: createdItemIds } },
      });
    } catch (cleanupErr) {
      console.error(
        'Failed to clean up partially created work items during rollback:',
        sanitizeLog(cleanupErr)
      );
    }
  }

  for (const orig of updatedOriginalStates) {
    try {
      await prisma.work_items.update({
        where: { id: orig.id },
        data: { parent_id: orig.parent_id },
      });
    } catch (restoreErr) {
      console.error(
        'Failed to restore updated work item during rollback:',
        sanitizeLog(restoreErr)
      );
    }
  }

  toolActionsPerformed.length = initialActionCount;

  const errMsg = err instanceof Error ? err.message : String(err);
  throw new Error(
    `Import failed: ${errMsg}. All changes were rolled back; no work items were created or modified.`
  );
}

interface ExistingWorkItemRecord {
  id: string;
  title: string;
  jira_issue_key: string | null;
  type: string;
  status: string;
  parent_id: string | null;
  priority: string;
}

interface HierarchyUpdateSummary {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly oldParentTitle: string;
  readonly newParentTitle: string;
}

interface BatchImportContext {
  userId: string;
  projectId: string;
  sprintId: string | null;
  projectKey: string;
  skipInvalidHierarchy: boolean;
  updateExisting: boolean;
  workItemService: Pick<WorkItemService, 'createWorkItem'>;
  existingWorkItems: ExistingWorkItemRecord[];
  idMapping: Map<string, string>;
  idTypeMapping: Map<string, WorkItemType>;
  createdItems: Array<{ id: string; key: string; title: string }>;
  updatedItems: Array<{ id: string; key: string; title: string }>;
  hierarchyUpdates: HierarchyUpdateSummary[];
  createdItemIds: string[];
  updatedOriginalStates: Array<{ id: string; parent_id: string | null }>;
  matchedExistingIds: Set<string>;
  skippedItems: Array<{ title: string; reason: string }>;
  toolActionsPerformed: ToolAction[];
}

function createBatchImportContext(params: {
  userId: string;
  projectId: string;
  sprintId: string | null;
  projectKey: string;
  skipInvalidHierarchy: boolean;
  updateExisting: boolean;
  workItemService: Pick<WorkItemService, 'createWorkItem'>;
  existingWorkItems: ExistingWorkItemRecord[];
  skippedItems: Array<{ title: string; reason: string }>;
  toolActionsPerformed: ToolAction[];
}): BatchImportContext {
  const idMapping = new Map<string, string>();
  const idTypeMapping = new Map<string, WorkItemType>();

  for (const existing of params.existingWorkItems) {
    idMapping.set(existing.id, existing.id);
    if (existing.jira_issue_key) {
      idMapping.set(existing.jira_issue_key.toUpperCase(), existing.id);
      idMapping.set(existing.jira_issue_key.toLowerCase(), existing.id);
    }
    idMapping.set(existing.title.toLowerCase().trim(), existing.id);
    idTypeMapping.set(existing.id, existing.type as WorkItemType);
  }

  return {
    ...params,
    idMapping,
    idTypeMapping,
    createdItems: [],
    updatedItems: [],
    hierarchyUpdates: [],
    createdItemIds: [],
    updatedOriginalStates: [],
    matchedExistingIds: new Set<string>(),
  };
}

async function executeChildNodesImport(
  ctx: BatchImportContext,
  children: ParsedWorkItemNode[],
  parentType: WorkItemType,
  parentTitle: string,
  parentId: string
): Promise<void> {
  const allowedChildType = getAllowedChildType(parentType);
  for (const child of children) {
    if (!allowedChildType) {
      if (ctx.skipInvalidHierarchy) {
        ctx.skippedItems.push({
          title: child.title,
          reason: `Parent of type ${parentType} cannot have subtasks`,
        });
        continue;
      }
      throw new Error(
        `Parent of type ${parentType} cannot have subtasks (found on "${parentTitle}"). Import aborted; no work items were created.`
      );
    }
    const effectiveChild: ParsedWorkItemNode = {
      ...child,
      type: allowedChildType || child.type,
    };
    await executeSingleNodeImport(ctx, effectiveChild, parentId);
  }
}

async function executeSingleNodeImport(
  ctx: BatchImportContext,
  node: ParsedWorkItemNode,
  resolvedParentId: string | null
): Promise<string> {
  const typeValue = (node.type || WorkItemTypeEnum.Task) as WorkItemType;
  const priorityValue = (node.priority ||
    DEFAULT_WORK_ITEM_PRIORITY) as WorkItemPriority;
  const existing = findExistingWorkItem(
    node,
    ctx.existingWorkItems,
    ctx.updateExisting
  );

  let workItemId: string;

  if (existing) {
    workItemId = existing.id;
    ctx.matchedExistingIds.add(existing.id);
    ctx.updatedOriginalStates.push({
      id: existing.id,
      parent_id: existing.parent_id,
    });

    await updateExistingWorkItemRecord({
      userId: ctx.userId,
      existingId: existing.id,
      resolvedParentId,
      typeValue,
      priorityValue,
      node,
    });

    const workItemKey =
      existing.jira_issue_key ||
      `${ctx.projectKey}-${existing.id.slice(0, 4).toUpperCase()}`;
    const summary = {
      id: existing.id,
      key: workItemKey,
      title: node.title || existing.title,
    };
    ctx.updatedItems.push(summary);
    ctx.toolActionsPerformed.push({
      type: 'update_work_item',
      entity: summary,
    });

    if (existing.parent_id !== resolvedParentId) {
      const oldParent = ctx.existingWorkItems.find(
        (e) => e.id === existing.parent_id
      );
      const newParent = ctx.existingWorkItems.find(
        (e) => e.id === resolvedParentId
      );
      ctx.hierarchyUpdates.push({
        id: existing.id,
        key: workItemKey,
        title: summary.title,
        oldParentTitle: oldParent ? oldParent.title : 'Root (No parent)',
        newParentTitle: newParent ? newParent.title : 'Root (No parent)',
      });
    }
  } else {
    const created = await ctx.workItemService.createWorkItem(ctx.userId, {
      title: node.title,
      project_id: ctx.projectId,
      sprint_id: ctx.sprintId,
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

    workItemId = created.id;
    ctx.createdItemIds.push(created.id);

    const workItemKey = `${ctx.projectKey}-${created.id.slice(0, 4).toUpperCase()}`;
    const summary = {
      id: created.id,
      key: workItemKey,
      title: created.title,
    };
    ctx.createdItems.push(summary);
    ctx.toolActionsPerformed.push({
      type: 'create_work_item',
      entity: summary,
    });
  }

  if (node.temporaryIdentifier) {
    ctx.idMapping.set(node.temporaryIdentifier, workItemId);
    ctx.idMapping.set(
      node.temporaryIdentifier.toLowerCase().trim(),
      workItemId
    );
    ctx.idMapping.set(
      node.temporaryIdentifier.toUpperCase().trim(),
      workItemId
    );
  }
  if (node.jiraIssueKey) {
    ctx.idMapping.set(node.jiraIssueKey, workItemId);
    ctx.idMapping.set(node.jiraIssueKey.toUpperCase().trim(), workItemId);
    ctx.idMapping.set(node.jiraIssueKey.toLowerCase().trim(), workItemId);
  }
  if (node.title) {
    ctx.idMapping.set(node.title.toLowerCase().trim(), workItemId);
  }
  ctx.idTypeMapping.set(workItemId, typeValue);

  if (node.children && node.children.length > 0) {
    await executeChildNodesImport(
      ctx,
      node.children,
      typeValue,
      node.title,
      workItemId
    );
  }

  return workItemId;
}

async function processReferencedParentItem(
  item: ParsedWorkItemNode,
  ctx: BatchImportContext
): Promise<void> {
  const parentRef = item.parentReference;
  const parentId = parentRef
    ? ctx.idMapping.get(parentRef) ||
      ctx.idMapping.get(parentRef.toLowerCase().trim()) ||
      ctx.idMapping.get(parentRef.toUpperCase().trim()) ||
      null
    : null;

  const parentType = parentId ? ctx.idTypeMapping.get(parentId) : undefined;
  const allowedChildType = parentType ? getAllowedChildType(parentType) : null;

  if (parentId && parentType && !allowedChildType) {
    if (ctx.skipInvalidHierarchy) {
      ctx.skippedItems.push({
        title: item.title,
        reason: `Parent of type ${parentType} cannot have subtasks`,
      });
      return;
    }
    throw new Error(
      `Parent of type ${parentType} cannot have subtasks. Import aborted; no work items were created.`
    );
  }

  const effectiveItem = allowedChildType
    ? { ...item, type: allowedChildType }
    : item;

  await executeSingleNodeImport(ctx, effectiveItem, parentId);
}

async function processValidImportItems(
  validItems: ParsedWorkItemNode[],
  ctx: BatchImportContext
): Promise<void> {
  for (const item of validItems) {
    if (!item.parentReference) {
      await executeSingleNodeImport(ctx, item, null);
    }
  }

  for (const item of validItems) {
    if (item.parentReference) {
      await processReferencedParentItem(item, ctx);
    }
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
    toolActionsPerformed: ToolAction[],
    history: StoredChatMessage[] = []
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
          toolActionsPerformed,
          history
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
    toolActionsPerformed: ToolAction[],
    history: StoredChatMessage[]
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
        this.handleParseWorkItemAttachment(args, history),
      check_work_item_duplicates: () =>
        this.handleCheckWorkItemDuplicates(args, history),
      batch_import_work_items: () =>
        this.handleBatchImportWorkItems(
          userId,
          args,
          toolActionsPerformed,
          history
        ),
      generate_project_fields_schema: () =>
        Promise.resolve(this.handleGenerateProjectFieldsSchema(args)),
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

  private resolveAttachment(
    providedRef: string | undefined,
    history: StoredChatMessage[]
  ): {
    url: string;
    fileName: string;
    fileType?: ChatAttachmentFileTypeEnum;
  } | null {
    const allAttachments = history.flatMap((m) => m.attachments || []);

    let cleanRef = providedRef?.trim();
    if (cleanRef) {
      const markdownUrlMatch = /\((https?:\/\/[^\s)]+)\)/.exec(cleanRef);
      if (markdownUrlMatch?.[1]) {
        cleanRef = markdownUrlMatch[1];
      }
    }

    if (
      cleanRef &&
      (cleanRef.startsWith('http://') || cleanRef.startsWith('https://'))
    ) {
      const matched = allAttachments.find((a) => a.url === cleanRef);
      return {
        url: cleanRef,
        fileName: matched?.fileName || 'attachment',
        fileType: matched?.fileType,
      };
    }

    if (cleanRef) {
      const lower = cleanRef.toLowerCase();
      const matched = allAttachments.find(
        (a) =>
          a.fileName.toLowerCase() === lower ||
          a.fileName.toLowerCase().includes(lower) ||
          lower.includes(a.fileName.toLowerCase()) ||
          a.id.toLowerCase() === lower
      );
      if (matched?.url) {
        return {
          url: matched.url,
          fileName: matched.fileName,
          fileType: matched.fileType,
        };
      }
    }

    const latestAttachment = allAttachments.at(-1);
    if (latestAttachment?.url) {
      return {
        url: latestAttachment.url,
        fileName: latestAttachment.fileName,
        fileType: latestAttachment.fileType,
      };
    }

    return null;
  }

  private async handleParseWorkItemAttachment(
    args: Record<string, unknown>,
    history: StoredChatMessage[]
  ): Promise<unknown> {
    const rawAttachmentUrl =
      typeof args.attachmentUrl === 'string' ? args.attachmentUrl : undefined;
    const resolved = this.resolveAttachment(rawAttachmentUrl, history);

    if (!resolved?.url) {
      throw new Error(
        'attachmentUrl could not be resolved from provided reference or chat history.'
      );
    }

    const fileName =
      typeof args.fileName === 'string' && args.fileName
        ? args.fileName
        : resolved.fileName;
    const fileType = resolved.fileType || ChatAttachmentFileTypeEnum.Other;

    const { items, summary } = await fetchAndParseWorkItemAttachment(
      resolved.url,
      fileName,
      fileType
    );

    return {
      summary,
      totalItemsFound: items.length,
      items,
    };
  }

  private async handleCheckWorkItemDuplicates(
    args: Record<string, unknown>,
    history: StoredChatMessage[]
  ): Promise<unknown> {
    const projectId = typeof args.projectId === 'string' ? args.projectId : '';
    if (!projectId) {
      throw new Error('projectId is required');
    }

    let itemsToAnalyze: ParsedWorkItemNode[] = [];
    if (Array.isArray(args.items) && args.items.length > 0) {
      itemsToAnalyze = args.items as ParsedWorkItemNode[];
    } else {
      const rawAttachmentUrl =
        typeof args.attachmentUrl === 'string' ? args.attachmentUrl : undefined;
      const resolved = this.resolveAttachment(rawAttachmentUrl, history);
      if (resolved?.url) {
        const parsed = await fetchAndParseWorkItemAttachment(
          resolved.url,
          resolved.fileName,
          resolved.fileType || ChatAttachmentFileTypeEnum.Other
        );
        itemsToAnalyze = parsed.items;
      }
    }

    const report = await this.deduplicationAgent.inspectAndDeduplicate(
      projectId,
      itemsToAnalyze
    );

    return report;
  }

  private async resolveItemsForImport(
    args: Record<string, unknown>,
    history: StoredChatMessage[]
  ): Promise<ParsedWorkItemNode[]> {
    if (Array.isArray(args.items) && args.items.length > 0) {
      return args.items as ParsedWorkItemNode[];
    }

    const rawAttachmentUrl =
      typeof args.attachmentUrl === 'string' ? args.attachmentUrl : undefined;
    const resolved = this.resolveAttachment(rawAttachmentUrl, history);
    if (!resolved?.url) {
      throw new Error(
        'attachmentUrl could not be resolved from provided reference or chat history, and no items list was provided.'
      );
    }
    const parsed = await fetchAndParseWorkItemAttachment(
      resolved.url,
      resolved.fileName,
      resolved.fileType || ChatAttachmentFileTypeEnum.Other
    );
    return parsed.items;
  }

  private filterAndValidateWorkItemHierarchy(
    items: ParsedWorkItemNode[],
    options: { skipInvalidHierarchy?: boolean }
  ): {
    validItems: ParsedWorkItemNode[];
    skippedItems: Array<{ title: string; reason: string }>;
  } {
    const skippedItems: Array<{ title: string; reason: string }> = [];
    const flatNodeMap = new Map<string, ParsedWorkItemNode>();

    for (const item of items) {
      if (item.temporaryIdentifier) {
        flatNodeMap.set(item.temporaryIdentifier, item);
        flatNodeMap.set(item.temporaryIdentifier.toLowerCase().trim(), item);
        flatNodeMap.set(item.temporaryIdentifier.toUpperCase().trim(), item);
      }
      if (item.jiraIssueKey) {
        flatNodeMap.set(item.jiraIssueKey, item);
        flatNodeMap.set(item.jiraIssueKey.toUpperCase().trim(), item);
        flatNodeMap.set(item.jiraIssueKey.toLowerCase().trim(), item);
      }
      if (item.title) {
        flatNodeMap.set(item.title.toLowerCase().trim(), item);
      }
    }

    const validItems: ParsedWorkItemNode[] = [];
    for (const item of items) {
      if (!isFlatItemHierarchyValid(item, flatNodeMap, options, skippedItems)) {
        continue;
      }
      const processed = validateAndPruneTreeNode(item, options, skippedItems);
      if (processed) {
        validItems.push(processed);
      }
    }

    return { validItems, skippedItems };
  }

  private async handleBatchImportWorkItems(
    userId: string,
    args: Record<string, unknown>,
    toolActionsPerformed: ToolAction[],
    history: StoredChatMessage[]
  ): Promise<unknown> {
    const projectId = typeof args.projectId === 'string' ? args.projectId : '';
    const sprintId = typeof args.sprintId === 'string' ? args.sprintId : null;
    const skipInvalidHierarchy = args.skipInvalidHierarchy === true;
    const updateExisting = args.updateExisting !== false;

    if (!projectId) {
      throw new Error('projectId is required');
    }

    const rawItems = await this.resolveItemsForImport(args, history);
    const { validItems, skippedItems } =
      this.filterAndValidateWorkItemHierarchy(rawItems, {
        skipInvalidHierarchy,
      });

    const project = await this.deps.projectsRepository.findById(projectId);
    const projectKey = project?.key || 'TASK';

    const existingWorkItems = await prisma.work_items.findMany({
      where: {
        project_id: projectId,
        record_status: 'active',
      },
      select: {
        id: true,
        title: true,
        jira_issue_key: true,
        type: true,
        status: true,
        parent_id: true,
        priority: true,
      },
    });

    const ctx = createBatchImportContext({
      userId,
      projectId,
      sprintId,
      projectKey,
      skipInvalidHierarchy,
      updateExisting,
      workItemService: this.deps.workItemService,
      existingWorkItems,
      skippedItems,
      toolActionsPerformed,
    });

    const initialActionCount = toolActionsPerformed.length;

    try {
      await processValidImportItems(validItems, ctx);

      const omittedItems = identifyOmittedWorkItems({
        projectKey,
        existingWorkItems,
        matchedExistingIds: ctx.matchedExistingIds,
      });

      return {
        importedCount: ctx.createdItems.length,
        createdCount: ctx.createdItems.length,
        items: ctx.createdItems,
        createdItems: ctx.createdItems,
        updatedCount: ctx.updatedItems.length,
        updatedItems: ctx.updatedItems,
        hierarchyUpdatedCount: ctx.hierarchyUpdates.length,
        hierarchyUpdates: ctx.hierarchyUpdates,
        omittedCount: omittedItems.length,
        omittedItems,
        omittedNotice:
          omittedItems.length > 0
            ? 'Deletion of work items is not allowed via Alice chat. The omitted work items remain in your project backlog.'
            : undefined,
        skippedCount: ctx.skippedItems.length,
        skippedItems: ctx.skippedItems,
      };
    } catch (err: unknown) {
      return rollbackBatchImport({
        createdItemIds: ctx.createdItemIds,
        updatedOriginalStates: ctx.updatedOriginalStates,
        initialActionCount,
        toolActionsPerformed,
        err,
      });
    }
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

  private async fetchHistoryMessages(
    conversationId: string
  ): Promise<StoredChatMessage[]> {
    const cached = this.historyCache.get(conversationId);
    if (cached) return cached;

    try {
      const mdText = await this.chat.downloadHistoryMarkdown(conversationId);
      return mdText ? markdownToChatHistory(mdText) : [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to load chat history for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(msg)
      );
      return [];
    }
  }

  private async refreshAttachmentAtIndex(
    attachments: NonNullable<StoredChatMessage['attachments']>,
    index: number,
    now: number
  ): Promise<boolean> {
    const att = attachments[index];
    if (!att?.id) return false;

    const isExpired =
      !att.expiresAt || new Date(att.expiresAt).getTime() <= now + 60_000;
    if (!isExpired) return false;

    try {
      const refreshed = await this.chatAttachmentsRepository.getAttachmentById(
        att.id
      );
      if (refreshed) {
        attachments[index] = refreshed;
        return true;
      }
    } catch (err: unknown) {
      console.error(
        `Failed to refresh chat attachment ${sanitizeLog(att.id)}:`,
        sanitizeLog(err instanceof Error ? err.message : String(err))
      );
    }
    return false;
  }

  private async refreshExpiredAttachments(
    messages: StoredChatMessage[]
  ): Promise<boolean> {
    const now = Date.now();
    let hasRefreshedAny = false;

    for (const msg of messages) {
      if (!msg.attachments || msg.attachments.length === 0) continue;
      for (let i = 0; i < msg.attachments.length; i++) {
        const refreshed = await this.refreshAttachmentAtIndex(
          msg.attachments,
          i,
          now
        );
        if (refreshed) {
          hasRefreshedAny = true;
        }
      }
    }

    return hasRefreshedAny;
  }

  async loadChatHistory(conversationId: string): Promise<StoredChatMessage[]> {
    const messages = await this.fetchHistoryMessages(conversationId);
    const hasRefreshedAny = await this.refreshExpiredAttachments(messages);

    this.historyCache.set(conversationId, messages);

    if (hasRefreshedAny) {
      void this.saveChatHistory(conversationId, messages).catch((err) => {
        console.error(
          `Failed to persist refreshed attachments for conversation ${sanitizeLog(conversationId)}:`,
          sanitizeLog(err instanceof Error ? err.message : String(err))
        );
      });
    }

    return messages;
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
      let text = msg.content;
      if (msg.attachments && msg.attachments.length > 0) {
        const attachInfo = msg.attachments
          .map((a) => `[Attachment: ${a.fileName} (URL: ${a.url})]`)
          .join('\n');
        text = text ? `${text}\n\n${attachInfo}` : attachInfo;
      }
      const parts = [{ text }];
      return { role, parts };
    });

    const [projectsRaw, workspace] = await Promise.all([
      this.deps.projectsRepository.listAll().catch(() => []),
      this.loadWorkspaceContext(),
    ]);

    const projects = (projectsRaw || []) as ProjectRowWithOwner[];
    const { users, activeSprints: sprints } = workspace;

    const allAttachments = history.flatMap((m) => m.attachments || []);
    let attachmentsInstruction = '';
    if (allAttachments.length > 0) {
      const attachmentsList = allAttachments
        .map(
          (a) => `- File: "${a.fileName}" (type: ${a.fileType}, URL: ${a.url})`
        )
        .join('\n');
      attachmentsInstruction = `
User Attached Documents in Conversation:
${attachmentsList}
You should access and parse these attachments using "parse_work_item_attachment". When calling "check_work_item_duplicates" or "batch_import_work_items", pass the attachmentUrl (or file name) or the parsed items.
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
        toolActionsPerformed,
        history
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

  handleGenerateProjectFieldsSchema(args: Record<string, unknown>): unknown {
    const rawFields = Array.isArray(args.fields) ? args.fields : [];
    const schema = buildSchemaFromRawFields(rawFields);
    return {
      success: true,
      schema,
    };
  }

  async generateProjectFieldsSchema(
    prompt: string,
    currentSchema?: unknown
  ): Promise<ProjectFieldsConfig> {
    const chatModel = await this.resolveChatModelForChat({});

    const userMessage = currentSchema
      ? `Current Schema:\n${JSON.stringify(currentSchema, null, 2)}\n\nUser Request: ${prompt}`
      : `User Request: ${prompt}`;

    const contents: ChatContentTurn[] = [
      {
        role: ChatTurnRoleEnum.USER,
        parts: [{ text: userMessage }],
      },
    ];

    const response = await this.callChatModelAPI(
      chatModel,
      contents,
      dynamicFieldsSystemPrompt
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const toolCallParsed = tryExtractToolCallSchema(parts);
    if (toolCallParsed) {
      return mergeWithCurrentSchema(toolCallParsed, currentSchema);
    }

    let jsonText = '';
    for (const part of parts) {
      if (part.text) {
        jsonText += part.text;
      }
    }

    const rawObj = extractJsonFromText(jsonText);
    const validated = ProjectFieldsConfigSchema.safeParse(rawObj);
    if (!validated.success) {
      throw new Error(
        `Generated schema is invalid: ${validated.error.issues.map((i) => i.message).join(', ')}`
      );
    }
    return mergeWithCurrentSchema(validated.data, currentSchema);
  }
}
