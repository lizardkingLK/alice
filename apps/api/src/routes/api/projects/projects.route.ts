import { Router } from 'express';
import multer, { type Multer } from 'multer';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { env } from '../../../config/env';
import {
  handleMultipartImageUpload,
  MAX_PUBLIC_IMAGE_BYTES,
} from '../../../lib/image-upload-route';
import {
  sendRouteMutationError,
  registerLockedStatusPatch,
} from '../../../lib/optimistic-lock';
import { ProjectsService } from './projects.service';
import {
  createProjectSchema,
  projectLockActionSchema,
  updateProjectSchema,
} from './projects.schemas';
import { withoutJiraToken } from './projects.repository';
import { type WorkItemBody } from '../workItems/workItems.schemas';
import type { WorkItemService } from '../workItems/workItems.service';
import { supabase } from '../../../lib/supabase';
import { mapToWorkItemType } from '@repo/types';
import type {
  CredentialSeed,
  JiraNode,
  JiraSearchResponse,
  ParsedJiraIssue,
  ResolvedJiraCredentials,
} from './projects.types';

export type ProjectsRouterDeps = {
  projectsService: ProjectsService;
  workItemService: Pick<WorkItemService, 'createWorkItem'>;
};

export function createProjectsRouter(deps: ProjectsRouterDeps) {
  const { projectsService, workItemService } = deps;
  const projectsRouter: Router = Router();

  const projectImageUpload: Multer = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_PUBLIC_IMAGE_BYTES,
    },
  });

  function registerProjectImageRoute(
    path: '/:id/logo' | '/:id/cover',
    failureLabel: string,
    update: (
      actorId: string,
      file: Express.Multer.File,
      expectedUpdatedAt: string,
      projectId: string
    ) => Promise<unknown>
  ) {
    projectsRouter.post(
      path,
      requireApiAuth,
      projectImageUpload.single('file'),
      async (req: AuthenticatedRequest, res) => {
        await handleMultipartImageUpload(req, res, {
          failureLabel,
          requireParam: 'id',
          missingParamMessage: 'Project ID is required',
          update: (actorId, file, expectedUpdatedAt, params) =>
            update(actorId, file, expectedUpdatedAt, params.id!),
        });
      }
    );
  }

  const jiraSettingsBodySchema = z.object({
    jiraUrl: z.url({ message: 'Jira URL must be a valid URL' }),
    jiraEmail: z.email({ message: 'Jira email must be a valid email' }),
    jiraToken: z.string().trim().min(1, { message: 'Jira token is required' }),
  });

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
        await workItemService.createWorkItem(params.actorId, workItemInput);
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
      `${cleanUrl}/rest/api/3/search/jql?jql=${jql}&fields=summary,description,issuetype,parent`,
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
      const jiraType = issue.fields?.issuetype?.name || '';
      const type = mapToWorkItemType(jiraType);
      const parentKey = issue.fields?.parent?.key || null;

      return {
        key: issue.key,
        title: issue.fields?.summary || 'Untitled',
        description: parseJiraDescription(issue.fields?.description),
        type,
        parentKey,
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
        const status = message.startsWith('Unauthorized') ? 403 : 500;
        res.status(status).json({ error: message });
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
          error instanceof Error
            ? error.message
            : 'Jira connection test failed';
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

        try {
          await projectsService.linkImportedJiraParents(
            req.userId!,
            projectId,
            issues
          );
        } catch (linkError) {
          console.error(
            'error. failed to link parents during Jira import:',
            linkError
          );
        }

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

  registerLockedStatusPatch({
    router: projectsRouter,
    path: '/:id/soft-delete',
    auth: requireApiAuth,
    missingIdMessage: 'Project ID is required',
    parseBody: (req) => projectLockActionSchema.safeParse(req.body),
    treeifyError: (error) => z.treeifyError(error as z.ZodError),
    action: (actorId, projectId, expectedUpdatedAt) =>
      projectsService.softDeleteProject(actorId, projectId, expectedUpdatedAt),
    toResponseBody: (project) => ({ project: withoutJiraToken(project) }),
    failureMessage: 'Failed to soft delete project',
  });

  registerLockedStatusPatch({
    router: projectsRouter,
    path: '/:id/restore',
    auth: requireApiAuth,
    missingIdMessage: 'Project ID is required',
    parseBody: (req) => projectLockActionSchema.safeParse(req.body),
    treeifyError: (error) => z.treeifyError(error as z.ZodError),
    action: (actorId, projectId, expectedUpdatedAt) =>
      projectsService.restoreProject(actorId, projectId, expectedUpdatedAt),
    toResponseBody: (project) => ({ project: withoutJiraToken(project) }),
    failureMessage: 'Failed to restore project',
  });

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

  registerProjectImageRoute(
    '/:id/logo',
    'project logo',
    (actorId, file, expectedUpdatedAt, projectId) =>
      projectsService.updateProjectLogo(
        actorId,
        projectId,
        file,
        expectedUpdatedAt
      )
  );

  registerProjectImageRoute(
    '/:id/cover',
    'project cover',
    (actorId, file, expectedUpdatedAt, projectId) =>
      projectsService.updateProjectCover(
        actorId,
        projectId,
        file,
        expectedUpdatedAt
      )
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
          error instanceof Error
            ? error.message
            : 'Failed to add project member';
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

  return projectsRouter;
}
