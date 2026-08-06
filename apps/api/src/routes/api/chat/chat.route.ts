import { Router } from 'express';
import { requireApiAuth, type AuthenticatedRequest } from '../../../middlewares/auth';
import { projectsService } from '../projects/projects.service';
import { projectsRepository, type ProjectRowWithOwner } from '../projects/projects.repository';
import { sprintsService } from '../sprints/sprints.service';
import { workItems } from '../../../config/composition';
import { supabase } from '../../../lib/supabase';

const chatRouter: Router = Router();

const systemInstruction = `You are Jira Teams Assistant, an AI assistant built into the Jira Teams monorepo.
Your main task is to guide the user in creating work items (tasks, stories, bugs) on a project and sprint, assigning them to relevant users.

When a user says they want to create a work item, follow this protocol:
1. First check if the project exists in the workspace:
   - Call \`list_projects\` to see the list of active projects.
   - If the user has specified a project (by name or key), check if it exists in that list.
   - IMPORTANT: If the project does not exist, or if the user's project is not found, you MUST ask the user: "Does this project exist? Or should I create a new one?"
   - If they ask to create it, call \`create_project\` with a name and uppercase key (2-10 letters).
2. Once the project is resolved (you have its UUID):
   - Check if the sprint is specified. If a sprint name is mentioned, check if it exists by calling \`list_sprints\` for that project.
   - If the sprint does not exist, ask the user if they want to create it or proceed without it (putting the work item in the backlog). If they want to create a sprint, call \`create_sprint\`.
3. Check the assignee:
   - Call \`list_users\` to find the list of users in the system.
   - Match the user's requested assignee (e.g. by name or email). If no user is matched or it is ambiguous, ask the user for clarification.
4. Once you have all the required parameters:
   - projectId (UUID)
   - title
   - type (story, task, bug - default to task if not specified)
   - priority (low, medium, high, highest - default to medium)
   - assigneeId (UUID, optional)
   - sprintId (UUID, optional)
   - description (optional)
   Call \`create_work_item\` to create the work item.
5. Provide a summary of the created item and its details.

Keep your responses friendly, helpful, and concise. Always confirm with the user before performing actions, but proactively call tools when appropriate.
`;

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

interface ContentPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: {
      result: unknown;
    };
  };
}

interface ContentTurn {
  role: 'user' | 'model';
  parts: ContentPart[];
}

interface GeminiCandidate {
  content?: ContentTurn;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface InputMessage {
  role: string;
  content?: string;
  text?: string;
  parts?: ContentPart[];
}

interface ToolAction {
  type: 'create_project' | 'create_sprint' | 'create_work_item';
  entity: {
    id: string;
    name?: string;
    key?: string;
    title?: string;
    status?: string;
  };
}

async function callGeminiAPI(contents: ContentTurn[], contextInstruction: string): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend .env file. Please add it to start chatting.');
  }

  const baseUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
  const url = baseUrl.includes('key=') ? `${baseUrl}${apiKey}` : `${baseUrl}?key=${apiKey}`;

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
        tools: [
          {
            functionDeclarations: [
              {
                name: 'list_projects',
                description: 'Retrieve all active projects in the system. Use this to see if a project exists.',
              },
              {
                name: 'create_project',
                description: 'Create a new project in the system.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING', description: 'Name of the project.' },
                    key: { type: 'STRING', description: 'Short unique capitalized key (2-10 letters).' },
                    description: { type: 'STRING', description: 'Description of the project (optional).' },
                  },
                  required: ['name', 'key'],
                },
              },
              {
                name: 'list_sprints',
                description: 'Retrieve all sprints for a specific project.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    projectId: { type: 'STRING', description: 'UUID of the project.' },
                  },
                  required: ['projectId'],
                },
              },
              {
                name: 'create_sprint',
                description: 'Create a new sprint for a specific project.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING', description: 'Name of the sprint.' },
                    projectId: { type: 'STRING', description: 'UUID of the project.' },
                    startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD (optional).' },
                    endDate: { type: 'STRING', description: 'End date YYYY-MM-DD (optional).' },
                  },
                  required: ['name', 'projectId'],
                },
              },
              {
                name: 'list_users',
                description: 'Retrieve list of all users in the system to find assignees.',
              },
              {
                name: 'create_work_item',
                description: 'Create a new work item.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING', description: 'Title of the work item.' },
                    projectId: { type: 'STRING', description: 'UUID of the project.' },
                    sprintId: { type: 'STRING', description: 'UUID of the sprint (optional).' },
                    assigneeId: { type: 'STRING', description: 'UUID of the user assigned (optional).' },
                    type: { type: 'STRING', enum: ['story', 'task', 'bug'], description: 'Type of work item.' },
                    priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'highest'], description: 'Priority level.' },
                    description: { type: 'STRING', description: 'Description of the work item (optional).' },
                  },
                  required: ['title', 'projectId', 'type', 'priority'],
                },
              },
            ],
          },
        ],
      }),
    });

    if (response.status === 429) {
      if (i < retries - 1) {
        console.warn(`Gemini rate limit exceeded. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error('Jira Teams AI rate limit reached. The Gemini API free tier quota has been temporarily exceeded. Please try again in a few moments.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<GeminiResponse>;
  }

  throw new Error('Failed to contact Gemini API due to repeated rate limits.');
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
  const projName = String(args.name || '');
  const projKey = String(args.key || '');
  const description = args.description ? String(args.description) : null;
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

async function handleListSprints(args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.projectId || '');
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
  const sprintName = String(args.name || '');
  const projectId = String(args.projectId || '');
  const startDate = args.startDate ? String(args.startDate) : (new Date().toISOString().split('T')[0] || '');
  const endDate = args.endDate ? String(args.endDate) : (new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '');
  const sprint = await sprintsService.createSprint(userId, {
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
  const title = String(args.title || '');
  const projectId = String(args.projectId || '');
  const sprintId = args.sprintId ? String(args.sprintId) : null;
  const assigneeId = args.assigneeId ? String(args.assigneeId) : null;

  let typeValue = String(args.type || 'task');
  if (typeValue.toLowerCase() === 'task') typeValue = 'Task';
  else if (typeValue.toLowerCase() === 'story') typeValue = 'Story';
  else if (typeValue.toLowerCase() === 'bug') typeValue = 'Issue';
  else typeValue = 'Task';

  const priorityValue = String(args.priority || 'medium');
  const description = args.description ? String(args.description) : null;

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

async function processFunctionCalls(
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
      result = await executeTool(userId, name, args || {}, toolActionsPerformed);
    } catch (err: unknown) {
      console.error(`Error executing tool ${name}:`, err);
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

chatRouter.post('/', requireApiAuth, async (req: AuthenticatedRequest, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your apps/api/.env file and restart the server.',
    });
  }

  try {
    const [projectsRaw, usersRaw, sprintsRaw] = await Promise.all([
      projectsRepository.listAll().catch(() => []),
      supabase.from('users').select('id, name, email'),
      supabase.from('sprints').select('id, name, project_id, status').eq('status', 'active')
    ]);

    const projects = (projectsRaw || []) as ProjectRowWithOwner[];
    const users = (usersRaw.data || []) as { id: string; name: string; email: string }[];
    const sprints = (sprintsRaw.data || []) as { id: string; name: string; project_id: string }[];

    const contextInstruction = `
Current Workspace State:
- Active Projects: ${JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, key: p.key })))}
- System Users: ${JSON.stringify(users.map(u => ({ id: u.id, name: u.name, email: u.email })))}
- Ongoing Sprints (Active Status Only): ${JSON.stringify(sprints.map(s => ({ id: s.id, name: s.name, projectId: s.project_id })))}
`;

    const contents: ContentTurn[] = messages.map((msg: InputMessage) => {
      let role = msg.role;
      if (role === 'assistant') {
        role = 'model';
      }

      let parts = msg.parts;
      if (!parts) {
        const textContent = msg.content || msg.text || '';
        parts = [{ text: textContent }];
      }

      return { role: role as 'user' | 'model', parts };
    });

    let responseText = '';
    const toolActionsPerformed: ToolAction[] = [];
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      const geminiResponse = await callGeminiAPI(contents, contextInstruction);
      const candidate = geminiResponse.candidates?.[0];
      const modelContent = candidate?.content;

      if (!modelContent) {
        throw new Error('No response content returned from Gemini API');
      }

      contents.push(modelContent);

      const functionCalls = modelContent.parts?.filter((p: ContentPart) => p.functionCall);
      if (!functionCalls || functionCalls.length === 0) {
        responseText = modelContent.parts?.map((p: ContentPart) => p.text || '').join('\n') || '';
        break;
      }

      const functionResponseParts = await processFunctionCalls(req.userId!, functionCalls, toolActionsPerformed);
      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      loopCount++;
    }

    res.json({
      reply: responseText,
      history: contents.map((c: ContentTurn) => {
        const role = c.role === 'model' ? 'assistant' : c.role;
        return {
          role,
          parts: c.parts,
          content: c.parts?.[0]?.text || '',
        };
      }),
      actions: toolActionsPerformed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process message';
    console.error('error. chatbot processing failed:', message);
    res.status(500).json({ error: message });
  }
});

export default chatRouter;
