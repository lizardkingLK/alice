import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { env } from '../../../config/env';
import {
  sendRouteMutationError,
  runLockedStatusRoute,
} from '../../../lib/optimistic-lock';
import { projectsService } from './projects.service';
import {
  createProjectSchema,
  projectLockActionSchema,
  updateProjectSchema,
} from './projects.schemas';
import { type ProjectRow, withoutJiraToken } from './projects.repository';
import { workItems } from '../../../config/composition';
import { type WorkItemBody } from '../workItems/workItems.schemas';
import { supabase } from '../../../lib/supabase';

const projectsRouter: Router = Router();

type ProjectLockAction = (
  actorId: string,
  projectId: string,
  expectedUpdatedAt: string
) => Promise<ProjectRow>;

async function handleProjectLockAction(
  req: AuthenticatedRequest,
  res: Response,
  action: ProjectLockAction,
  failureMessage: string
) {
  await runLockedStatusRoute({
    res,
    actorId: req.userId!,
    id: req.params.id,
    missingIdMessage: 'Project ID is required',
    parseBody: () => projectLockActionSchema.safeParse(req.body),
    treeifyError: (error) => z.treeifyError(error as z.ZodError),
    action,
    toResponseBody: (project) => ({ project: withoutJiraToken(project) }),
    failureMessage,
  });
}

function registerProjectLockAction(
  path: '/:id/soft-delete' | '/:id/restore',
  action: ProjectLockAction,
  failureMessage: string
) {
  projectsRouter.patch(
    path,
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      await handleProjectLockAction(req, res, action, failureMessage);
    }
  );
}

const jiraSettingsBodySchema = z.object({
  jiraUrl: z.url({ message: 'Jira URL must be a valid URL' }),
  jiraEmail: z.email({ message: 'Jira email must be a valid email' }),
  jiraToken: z.string().trim().min(1, { message: 'Jira token is required' }),
});

type ResolvedJiraCredentials = {
  jiraUrl: string;
  jiraToken: string;
  jiraProjectKey: string;
  jiraEmail: string;
};

type CredentialSeed = {
  jiraUrl?: string;
  jiraToken?: string;
  jiraProjectKey?: string;
  jiraEmail?: string;
};

function mergeCredentialSeed(
  current: CredentialSeed,
  next: {
    jira_url?: string | null;
    jira_token?: string | null;
    jira_project_key?: string | null;
    jira_email?: string | null;
  }
): CredentialSeed {
  return {
    jiraUrl: current.jiraUrl || next.jira_url || undefined,
    jiraToken: current.jiraToken || next.jira_token || undefined,
    jiraProjectKey:
      current.jiraProjectKey || next.jira_project_key || undefined,
    jiraEmail: current.jiraEmail || next.jira_email || undefined,
  };
}

function credentialsIncomplete(seed: CredentialSeed): boolean {
  return !seed.jiraUrl || !seed.jiraToken || !seed.jiraProjectKey;
}

/**
 * Resolve Jira credentials from request body → project row → global settings → env.
 * `requireProject` controls 404 vs soft-skip when projectId is missing/not found.
 */
async function resolveJiraCredentials(params: {
  actorId: string;
  projectId?: string;
  jiraUrl?: string | null;
  jiraToken?: string | null;
  jiraProjectKey?: string | null;
  jiraEmail?: string | null;
  requireProject: boolean;
}): Promise<
  | { ok: true; credentials: ResolvedJiraCredentials }
  | { ok: false; status: 400 | 404; error: string }
> {
  let seed: CredentialSeed = {
    jiraUrl: params.jiraUrl || undefined,
    jiraToken: params.jiraToken || env.JIRA_API_TOKEN || undefined,
    jiraProjectKey: params.jiraProjectKey || undefined,
    jiraEmail: params.jiraEmail || env.JIRA_EMAIL || undefined,
  };

  if (params.projectId && credentialsIncomplete(seed)) {
    try {
      const project = await projectsService.getProjectById(params.projectId);
      seed = mergeCredentialSeed(seed, project);
    } catch {
      if (params.requireProject) {
        return { ok: false, status: 404, error: 'Project not found' };
      }
    }
  }

  if (!seed.jiraUrl || !seed.jiraToken) {
    const globalSettings = await projectsService.getJiraSettings(
      params.actorId
    );
    if (globalSettings) {
      seed = mergeCredentialSeed(seed, globalSettings);
    }
  }

  if (credentialsIncomplete(seed)) {
    return {
      ok: false,
      status: 400,
      error: params.requireProject
        ? 'Jira integration is not configured. Please provide credentials or set up global settings.'
        : 'Jira URL, Token, and Project Key are required',
    };
  }

  return {
    ok: true,
    credentials: {
      jiraUrl: seed.jiraUrl!,
      jiraToken: seed.jiraToken!,
      jiraProjectKey: seed.jiraProjectKey!,
      jiraEmail: seed.jiraEmail || 'integration@example.com',
    },
  };
}

async function loadExistingJiraKeys(projectId: string): Promise<Set<string>> {
  const { data: existingWorkItems } = await supabase
    .from('work_items')
    .select('jira_issue_key')
    .eq('project_id', projectId)
    .not('jira_issue_key', 'is', null);

  return new Set(
    (existingWorkItems || [])
      .map((item: { jira_issue_key: string | null }) => item.jira_issue_key)
      .filter((key: string | null): key is string => Boolean(key))
  );
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return (
    /duplicate|unique|already exists/i.test(message) ||
    message.includes('23505')
  );
}

async function importParsedJiraIssues(params: {
  actorId: string;
  projectId: string;
  issues: ParsedJiraIssue[];
  existingKeys: Set<string>;
}): Promise<number> {
  let importedCount = 0;

  for (const issue of params.issues) {
    if (params.existingKeys.has(issue.key)) {
      continue;
    }

    const workItemInput: WorkItemBody = {
      title: issue.title,
      project_id: params.projectId,
      type: issue.type,
      assignee_id: null,
      due_date: null,
      description: issue.description || null,
      jira_issue_key: issue.key,
    };

    try {
      await workItems.workItemService.createWorkItem(
        params.actorId,
        workItemInput
      );
      importedCount++;
      params.existingKeys.add(issue.key);
    } catch (createError) {
      if (isUniqueViolation(createError)) {
        params.existingKeys.add(issue.key);
        continue;
      }
      throw createError;
    }
  }

  return importedCount;
}

interface JiraIssueField {
  summary?: string;
  issuetype?: {
    name?: string;
  };
  description?: unknown;
}

interface JiraIssue {
  key: string;
  fields?: JiraIssueField;
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
}

interface JiraNode {
  type?: string;
  text?: string;
  content?: JiraNode[];
}

interface ParsedJiraIssue {
  key: string;
  title: string;
  description: string;
  type: 'Task' | 'Story' | 'Epic';
}

function extractText(node: JiraNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  let text = '';
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractText(child);
    }
  }
  return text;
}

function parseJiraDescription(descObj: unknown): string {
  if (!descObj) return '';
  if (typeof descObj === 'string') {
    return descObj;
  }
  if (typeof descObj === 'object') {
    return extractText(descObj as JiraNode);
  }
  return '';
}

async function fetchAndParseJiraIssues(
  jiraUrl: string,
  jiraToken: string,
  jiraProjectKey: string,
  jiraEmail: string
): Promise<ParsedJiraIssue[]> {
  let url = jiraUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url); // NOSONAR
  } catch {
    throw new Error('Invalid Jira URL format');
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Whitelist check: Must end with .atlassian.net to prevent SSRF
  if (!hostname.endsWith('.atlassian.net')) {
    throw new Error('Only Jira Cloud domains (*.atlassian.net) are allowed');
  }

  // Extract the subdomain and validate it is alphanumeric + hyphens only
  const subdomain = hostname.slice(0, -'.atlassian.net'.length);
  if (!/^[a-zA-Z0-9-]+$/.test(subdomain)) {
    throw new Error('Invalid Jira Cloud subdomain format');
  }

  // Reconstruct the URL from the safe, validated components
  // This breaks the taint chain and guarantees that only public Jira Cloud domains are requested.
  const cleanUrl = `https://${subdomain}.atlassian.net`;

  const credentials = `${jiraEmail.trim()}:${jiraToken.trim()}`;
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;
  const jql = encodeURIComponent(`project="${jiraProjectKey.trim()}"`);
  const response = await fetch(
    `${cleanUrl}/rest/api/3/search/jql?jql=${jql}&fields=summary,description,issuetype`,
    {
      // NOSONAR
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API request failed with status ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as JiraSearchResponse;
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error('Invalid response format from Jira API');
  }

  return data.issues.map((issue) => {
    let type: 'Task' | 'Story' | 'Epic' = 'Task';
    const jiraType = (issue.fields?.issuetype?.name || '').toLowerCase();
    if (jiraType === 'story') {
      type = 'Story';
    } else if (jiraType === 'epic') {
      type = 'Epic';
    }

    return {
      key: issue.key,
      title: issue.fields?.summary || 'Untitled',
      description: parseJiraDescription(issue.fields?.description),
      type,
    };
  });
}

projectsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const project = await projectsService.createProject(req.userId!, {
        name: parsed.data.name,
        key: parsed.data.key,
        description: parsed.data.description ?? null,
        owner_id: parsed.data.owner_id,
        start_date: parsed.data.start_date ?? null,
        end_date: parsed.data.end_date ?? null,
        status: parsed.data.status ?? 'active',
        jira_url: parsed.data.jira_url ?? null,
        jira_email: parsed.data.jira_email ?? null,
        jira_token: parsed.data.jira_token ?? null,
        jira_project_key: parsed.data.jira_project_key ?? null,
        github_repo: parsed.data.github_repo ?? null,
        github_token: parsed.data.github_token ?? null,
      });
      res.status(201).json({ project: withoutJiraToken(project) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.post(
  '/jira/preview',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, jiraUrl, jiraToken, jiraProjectKey, jiraEmail } =
      req.body;

    try {
      const resolved = await resolveJiraCredentials({
        actorId: req.userId!,
        projectId,
        jiraUrl,
        jiraToken,
        jiraProjectKey,
        jiraEmail,
        requireProject: false,
      });

      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error });
      }

      const { credentials } = resolved;
      const issues = await fetchAndParseJiraIssues(
        credentials.jiraUrl,
        credentials.jiraToken,
        credentials.jiraProjectKey,
        credentials.jiraEmail
      );
      res.json({ issues });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Jira connection test failed';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.post(
  '/jira/import',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, jiraUrl, jiraToken, jiraProjectKey, jiraEmail } =
      req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    let importedCount = 0;
    try {
      const resolved = await resolveJiraCredentials({
        actorId: req.userId!,
        projectId,
        jiraUrl,
        jiraToken,
        jiraProjectKey,
        jiraEmail,
        requireProject: true,
      });

      if (!resolved.ok) {
        return res.status(resolved.status).json({ error: resolved.error });
      }

      const { credentials } = resolved;
      const existingKeys = await loadExistingJiraKeys(projectId);
      const issues = await fetchAndParseJiraIssues(
        credentials.jiraUrl,
        credentials.jiraToken,
        credentials.jiraProjectKey,
        credentials.jiraEmail
      );

      importedCount = await importParsedJiraIssues({
        actorId: req.userId!,
        projectId,
        issues,
        existingKeys,
      });

      res.json({ success: true, importedCount });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Jira import failed';
      res.status(500).json({
        error: message,
        importedCount,
        partial: importedCount > 0,
      });
    }
  }
);

projectsRouter.put(
  '/jira/settings',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const parsed = jiraSettingsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    const { jiraUrl, jiraEmail, jiraToken } = parsed.data;

    try {
      await projectsService.saveJiraSettings(
        req.userId!,
        jiraUrl,
        jiraEmail,
        jiraToken
      );
      res.json({ success: true, jiraUrl, jiraEmail });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save settings';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.put(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const { expectedUpdatedAt, ...input } = parsed.data;
      const project = await projectsService.updateProject(
        req.userId!,
        id,
        input,
        expectedUpdatedAt
      );
      res.json({ project: withoutJiraToken(project) });
    } catch (error) {
      sendRouteMutationError(res, error, 'Failed to update project');
    }
  }
);

registerProjectLockAction(
  '/:id/soft-delete',
  (actorId, projectId, expectedUpdatedAt) =>
    projectsService.softDeleteProject(actorId, projectId, expectedUpdatedAt),
  'Failed to soft delete project'
);

registerProjectLockAction(
  '/:id/restore',
  (actorId, projectId, expectedUpdatedAt) =>
    projectsService.restoreProject(actorId, projectId, expectedUpdatedAt),
  'Failed to restore project'
);

projectsRouter.delete(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      await projectsService.hardDeleteProject(req.userId!, id);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to hard delete project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.post(
  '/:id/members',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    try {
      await projectsService.addMember(req.userId!, id, userId);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add project member';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.delete(
  '/:id/members/:userId',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id, userId } = req.params;
    if (!id || !userId) {
      return res
        .status(400)
        .json({ error: 'Project ID and User ID are required' });
    }
    try {
      await projectsService.removeMember(req.userId!, id, userId);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to remove project member';
      res.status(500).json({ error: message });
    }
  }
);

export default projectsRouter;
