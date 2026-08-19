import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getRoleName,
  DEFAULT_CHAT_MODEL_VALUE,
  resolveChatModel,
  type ChatModelValue,
  WorkItemTypeEnum,
  DEFAULT_WORK_ITEM_PRIORITY,
  WORK_ITEM_PRIORITIES,
  ProjectStatusEnum,
  type WorkItemType,
} from '@repo/types';
import { projectsService } from '../projects/projects.service';
import { projectsRepository } from '../projects/projects.repository';
import type { WorkItemService } from '../workItems/workItems.service';
import type { SprintsService } from '../sprints/sprints.service';
import { systemInstruction, geminiTools } from './chat.route.data';
import type { ChatRepository } from './chat.repository';
import { sanitizeLog } from './chat.utils';
import type {
  ContentPart,
  ContentTurn,
  GeminiResponse,
  ToolAction,
  StoredChatMessage,
} from './chat.route.types';

export { sanitizeLog } from './chat.utils';

export type ChatServiceDeps = {
  chat: ChatRepository;
  workItemService: Pick<WorkItemService, 'createWorkItem'>;
  sprintsService: Pick<SprintsService, 'createSprint'>;
};

function textToProseMirrorJson(text: string | null | undefined) {
  if (!text) return null;
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: text,
          },
        ],
      },
    ],
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

function logGeminiError(errorDetails: {
  timestamp: string;
  status: number;
  statusText: string;
  errorBody: string;
  attempt: number;
  messagesCount: number;
}) {
  const logMessage: string = [
    `[${errorDetails.timestamp}]`,
    'Attempt',
    errorDetails.attempt,
    'failed with Status',
    errorDetails.status,
    `${errorDetails.statusText}.`,
    'Body:',
    `${errorDetails.errorBody}.`,
    'Messages in history:',
    `${errorDetails.messagesCount}\n`,
  ].join(' ');

  console.error(
    `Gemini Error: Request failed with status ${errorDetails.status}. See gemini-errors.log for details.`
  );
  try {
    const logFilePath = path.join(__dirname, '../../../../gemini-errors.log');
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    const errorName = err instanceof Error ? err.name : 'UnknownError';
    console.error(
      `Failed to write to gemini-errors.log: ${sanitizeLog(errorName)}`
    );
  }
}

export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  private get chat() {
    return this.deps.chat;
  }

  private resolveGeminiBaseUrl(modelValue: ChatModelValue): string {
    return resolveChatModel(modelValue).apiUrl;
  }

  async processFunctionCalls(
    userId: string,
    functionCalls: ContentPart[],
    toolActionsPerformed: ToolAction[]
  ): Promise<ContentPart[]> {
    const functionResponseParts: ContentPart[] = [];
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
    if (name === 'list_projects') {
      return this.handleListProjects();
    }
    if (name === 'create_project') {
      return this.handleCreateProject(userId, args, toolActionsPerformed);
    }
    if (name === 'list_sprints') {
      return this.handleListSprints(args);
    }
    if (name === 'create_sprint') {
      return this.handleCreateSprint(userId, args, toolActionsPerformed);
    }
    if (name === 'list_users') {
      return this.chat.listUsersSnapshot();
    }
    if (name === 'create_work_item') {
      return this.handleCreateWorkItem(userId, args, toolActionsPerformed);
    }
    throw new Error(`Unknown function: ${name}`);
  }

  private async handleListProjects(): Promise<unknown> {
    const projects = await projectsRepository.listAll();
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
    const project = await projectsService.createProject(userId, {
      name: projName,
      key: projKey.toUpperCase(),
      description,
      status: ProjectStatusEnum.active,
      start_date: null,
      end_date: null,
      owner_id: userId,
      jira_url: null,
      jira_email: null,
      jira_token: null,
      jira_project_key: null,
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

    let typeValue: WorkItemType = WorkItemTypeEnum.Task;
    if (typeof args.type === 'string') {
      const normalized = args.type.toLowerCase();
      if (normalized === 'story') typeValue = WorkItemTypeEnum.Story;
      else if (normalized === 'bug' || normalized === 'issue')
        typeValue = WorkItemTypeEnum.Issue;
    }

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
    const project = await projectsRepository.findById(projectId);
    const projectKey = project?.key || 'TASK';
    const workItemKey = `${projectKey}-${workItem.id.slice(0, 4).toUpperCase()}`;
    const result = { id: workItem.id, key: workItemKey, title: workItem.title };
    toolActionsPerformed.push({ type: 'create_work_item', entity: result });
    return result;
  }

  async callGeminiAPI(
    contents: ContentTurn[],
    contextInstruction: string,
    modelValue: ChatModelValue = DEFAULT_CHAT_MODEL_VALUE
  ): Promise<GeminiResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in backend .env file. Please add it to start chatting.'
      );
    }

    const baseUrl =
      process.env.GEMINI_API_URL || this.resolveGeminiBaseUrl(modelValue);
    const url = baseUrl.includes('key=')
      ? `${baseUrl}${apiKey}`
      : `${baseUrl}?key=${apiKey}`;

    const retries = 3;
    let delay = 2000;

    for (let i = 0; i < retries; i++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction + '\n' + contextInstruction }],
          },
          tools: geminiTools,
        }),
      });

      if (
        response.status === 429 ||
        response.status === 503 ||
        (response.status >= 500 && response.status <= 504)
      ) {
        const errorText = await response.text();
        logGeminiError({
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          attempt: i + 1,
          messagesCount: contents.length,
        });

        if (i < retries - 1) {
          console.warn(
            `Gemini transient error ${response.status}. Retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw new Error(
          `Alice AI service is temporarily unavailable due to Gemini error ${response.status}: ${errorText}`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        logGeminiError({
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          attempt: i + 1,
          messagesCount: contents.length,
        });
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      return response.json() as Promise<GeminiResponse>;
    }

    throw new Error(
      'Failed to contact Gemini API due to repeated rate limits.'
    );
  }

  async saveChatHistory(
    conversationId: string,
    messages: StoredChatMessage[]
  ): Promise<void> {
    try {
      const mdContent = chatHistoryToMarkdown(conversationId, messages);
      await this.chat.uploadHistoryMarkdown(conversationId, mdContent);
      await this.chat.touchConversationUpdatedAt(conversationId);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to save chat history for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(msg)
      );
    }
  }

  async loadChatHistory(conversationId: string): Promise<StoredChatMessage[]> {
    try {
      const mdText = await this.chat.downloadHistoryMarkdown(conversationId);
      if (!mdText) return [];
      return markdownToChatHistory(mdText);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to load chat history for conversation ${sanitizeLog(conversationId)}:`,
        sanitizeLog(msg)
      );
      return [];
    }
  }

  async listConversations(userId: string) {
    return this.chat.listConversations(userId);
  }

  async createConversation(
    userId: string,
    title = 'New Chat'
  ): Promise<string> {
    return this.chat.createConversation(userId, title);
  }

  async deleteConversation(
    userId: string,
    conversationId: string
  ): Promise<void> {
    await this.chat.deleteConversation(userId, conversationId);

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
}
