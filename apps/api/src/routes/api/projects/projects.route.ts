import { Router } from 'express';
import multer, { type Multer } from 'multer';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  handleMultipartImageUpload,
  MAX_PUBLIC_IMAGE_BYTES,
} from '../../../lib/image-upload-route';
import {
  sendRouteMutationError,
  registerLockedStatusPatch,
} from '../../../lib/optimistic-lock';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import { ProjectsService } from './projects.service';
import {
  createProjectSchema,
  projectLockActionSchema,
  updateProjectSchema,
} from './projects.schemas';
import { withoutIntegrationSecrets } from './projects.repository';
import { type WorkItemBody } from '../workItems/workItems.schemas';
import type { WorkItemService } from '../workItems/workItems.service';
import { supabase } from '../../../lib/supabase';
import type { JiraService } from '../jira/jira.service';
import type { ParsedJiraIssue } from '../jira/jira.types';
import { listProjectsQuerySchema } from '@repo/types';

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function listProjectsQueryFromRequest(query: Record<string, unknown>) {
  return listProjectsQuerySchema.safeParse({
    page: firstQueryValue(query.page),
    limit: firstQueryValue(query.limit),
    status: firstQueryValue(query.status),
    search: firstQueryValue(query.search),
  });
}

export type ProjectsRouterDeps = {
  projectsService: ProjectsService;
  workItemService: Pick<WorkItemService, 'createWorkItem'>;
  jiraService: Pick<JiraService, 'fetchIssuesForProjectLink'>;
};

export function createProjectsRouter(deps: ProjectsRouterDeps) {
  const { projectsService, workItemService, jiraService } = deps;
  const projectsRouter: Router = Router();

  projectsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listProjectsQueryFromRequest(
        req.query as Record<string, unknown>
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const result = await projectsService.listProjectsPaginated(
          parsed.data,
          req.userId!
        );
        res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to list projects';
        res.status(500).json({ error: message });
      }
    }
  );

  projectsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res
          .status(400)
          .json({ data: null, error: 'Invalid project id' });
      }

      try {
        const project = await projectsService.getProjectDetail(
          parsedId.data,
          req.userId!
        );
        if (!project) {
          return res
            .status(404)
            .json({ data: null, error: 'Project not found' });
        }
        const sanitized = withoutIntegrationSecrets(project);
        res.json({ data: sanitized, error: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to get project';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  projectsRouter.get(
    '/:id/members',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res
          .status(400)
          .json({ error: 'Invalid project id' });
      }

      try {
        const members = await projectsService.listProjectMembersPrisma(
          parsedId.data,
          req.userId!
        );
        res.json({ members });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to list project members';
        res.status(500).json({ error: message });
      }
    }
  );

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

  async function resolveProjectJiraLink(projectId: string): Promise<
    | {
        ok: true;
        connectionId: string;
        projectKey: string;
      }
    | { ok: false; status: 400 | 404; error: string }
  > {
    let project;
    try {
      project = await projectsService.getProjectById(projectId);
    } catch {
      return { ok: false, status: 404, error: 'Project not found' };
    }

    if (!project.jira_connection_id || !project.jira_project_key) {
      return {
        ok: false,
        status: 400,
        error:
          'Jira is not linked on this project. Set jira_connection_id and jira_project_key first.',
      };
    }

    return {
      ok: true,
      connectionId: project.jira_connection_id,
      projectKey: project.jira_project_key,
    };
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
          jira_project_key: parsed.data.jira_project_key ?? null,
          jira_connection_id: parsed.data.jira_connection_id ?? null,
          github_repo: parsed.data.github_repo ?? null,
          github_token: parsed.data.github_token ?? null,
        });
        res.status(201).json({ project: withoutIntegrationSecrets(project) });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to create project'
        );
        res.status(status).json({ error: message });
      }
    }
  );

  projectsRouter.post(
    '/:id/jira/preview',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      try {
        const link = await resolveProjectJiraLink(id);
        if (!link.ok) {
          return res.status(link.status).json({ error: link.error });
        }

        const issues = await jiraService.fetchIssuesForProjectLink(
          req.userId!,
          link.connectionId,
          link.projectKey
        );
        res.json({ issues });
      } catch (error) {
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Jira connection preview failed'
        );
        res.status(status).json({ error: message });
      }
    }
  );

  projectsRouter.post(
    '/:id/jira/import',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      let importedCount = 0;
      try {
        const link = await resolveProjectJiraLink(id);
        if (!link.ok) {
          return res.status(link.status).json({ error: link.error });
        }

        const existingKeys = await loadExistingJiraKeys(id);
        const issues = await jiraService.fetchIssuesForProjectLink(
          req.userId!,
          link.connectionId,
          link.projectKey
        );

        importedCount = await importParsedJiraIssues({
          actorId: req.userId!,
          projectId: id,
          issues,
          existingKeys,
        });

        try {
          await projectsService.linkImportedJiraParents(
            req.userId!,
            id,
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
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Jira import failed'
        );
        res.status(status).json({
          error: message,
          importedCount,
          partial: importedCount > 0,
        });
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
        res.json({ project: withoutIntegrationSecrets(project) });
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
    toResponseBody: (project) => ({
      project: withoutIntegrationSecrets(project),
    }),
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
    toResponseBody: (project) => ({
      project: withoutIntegrationSecrets(project),
    }),
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
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to hard delete project'
        );
        return res.status(status).json({ error: message });
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
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to add project member'
        );
        return res.status(status).json({ error: message });
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
        const { status, error: message } = jsonErrorFromCaught(
          error,
          'Failed to remove project member'
        );
        return res.status(status).json({ error: message });
      }
    }
  );

  return projectsRouter;
}
