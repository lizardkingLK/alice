import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectsService } from '../projects/projects.service';
import { projectsRepository } from '../projects/projects.repository';
import { workItems, sprints } from '../../../config/composition';
import { supabase } from '../../../lib/supabase';
import { systemInstruction, geminiTools } from './chat.route.data';
import type {
  ContentPart,
  ContentTurn,
  GeminiResponse,
  ToolAction,
} from './chat.route.types';

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

async function handleListProjects(): Promise<unknown> {
  const projects = await projectsRepository.listAll();
  return projects.map((p) => ({ id: p.id, name: p.name, key: p.key }));
}

async function handleCreateProject(
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
    status: 'active',
    start_date: null,
    end_date: null,
    owner_id: userId,
    jira_url: null,
    jira_email: null,
    jira_token: null,
    jira_project_key: null,
  });
  const result = { id: project.id, name: project.name, key: project.key };
  toolActionsPerformed.push({ type: 'create_project', entity: result });
  return result;
}

async function handleListSprints(
  args: Record<string, unknown>
): Promise<unknown> {
  const projectId = typeof args.projectId === 'string' ? args.projectId : '';
  const { data: sprints, error } = await supabase
    .from('sprints')
    .select('id, name, status, start_date, end_date')
    .eq('project_id', projectId);
  if (error) throw error;
  return sprints || [];
}

async function handleCreateSprint(
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
  const sprint = await sprints.sprintsService.createSprint(userId, {
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

async function handleListUsers(): Promise<unknown> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email');
  if (error) throw error;
  return users || [];
}

async function handleCreateWorkItem(
  userId: string,
  args: Record<string, unknown>,
  toolActionsPerformed: ToolAction[]
): Promise<unknown> {
  const title = typeof args.title === 'string' ? args.title : '';
  const projectId = typeof args.projectId === 'string' ? args.projectId : '';
  const sprintId = typeof args.sprintId === 'string' ? args.sprintId : null;
  const assigneeId =
    typeof args.assigneeId === 'string' ? args.assigneeId : null;

  let typeValue = typeof args.type === 'string' ? args.type : 'task';
  if (typeValue.toLowerCase() === 'task') typeValue = 'Task';
  else if (typeValue.toLowerCase() === 'story') typeValue = 'Story';
  else if (typeValue.toLowerCase() === 'bug') typeValue = 'Issue';
  else typeValue = 'Task';

  const priorityValue =
    typeof args.priority === 'string' ? args.priority : 'medium';
  const description =
    typeof args.description === 'string' ? args.description : null;

  const workItem = await workItems.workItemService.createWorkItem(userId, {
    title,
    project_id: projectId,
    sprint_id: sprintId,
    assignee_id: assigneeId,
    type: typeValue as 'Task' | 'Story' | 'Epic' | 'Issue',
    priority: priorityValue as 'low' | 'medium' | 'high' | 'highest' | 'lowest',
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

async function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
  toolActionsPerformed: ToolAction[]
): Promise<unknown> {
  if (name === 'list_projects') {
    return handleListProjects();
  }
  if (name === 'create_project') {
    return handleCreateProject(userId, args, toolActionsPerformed);
  }
  if (name === 'list_sprints') {
    return handleListSprints(args);
  }
  if (name === 'create_sprint') {
    return handleCreateSprint(userId, args, toolActionsPerformed);
  }
  if (name === 'list_users') {
    return handleListUsers();
  }
  if (name === 'create_work_item') {
    return handleCreateWorkItem(userId, args, toolActionsPerformed);
  }
  throw new Error(`Unknown function: ${name}`);
}

export async function processFunctionCalls(
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
      result = await executeTool(
        userId,
        name,
        args || {},
        toolActionsPerformed
      );
    } catch (err: unknown) {
      console.error(`Error executing tool ${name}`);
      result = { error: err instanceof Error ? err.message : 'Unknown error' };
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

function logGeminiError(errorDetails: {
  timestamp: string;
  status: number;
  statusText: string;
  errorBody: string;
  attempt: number;
  messagesCount: number;
}) {
  const logMessage = `[${errorDetails.timestamp}] Attempt ${errorDetails.attempt} failed with Status ${errorDetails.status} (${errorDetails.statusText}). Body: ${errorDetails.errorBody}. Messages in history: ${errorDetails.messagesCount}\n`;
  console.error(
    `Gemini Error: Request failed with status ${errorDetails.status}. See gemini-errors.log for details.`
  );
  try {
    const logFilePath = path.join(__dirname, '../../../../gemini-errors.log');
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    const errorName = err instanceof Error ? err.name : 'UnknownError';
    console.error(`Failed to write to gemini-errors.log: ${errorName}`);
  }
}

export async function callGeminiAPI(
  contents: ContentTurn[],
  contextInstruction: string
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in backend .env file. Please add it to start chatting.'
    );
  }

  const baseUrl =
    process.env.GEMINI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
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
        `Jira Teams AI service is temporarily unavailable due to Gemini error ${response.status}: ${errorText}`
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

  throw new Error('Failed to contact Gemini API due to repeated rate limits.');
}
