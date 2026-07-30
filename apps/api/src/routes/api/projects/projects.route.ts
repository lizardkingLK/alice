import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { projectsService } from './projects.service';
import { createProjectSchema, updateProjectSchema } from './projects.schemas';
import { parsePagination } from '../../../lib/pagination';
import { ProjectRowWithOwner } from './projects.repository';
import { workItems } from '../../../config/composition';
import { type WorkItemBody } from '../workItems/workItems.schemas';
import { supabase } from '../../../lib/supabase';


const projectsRouter: Router = Router();

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
  jiraProjectKey: string
): Promise<ParsedJiraIssue[]> {
  let url = jiraUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  const jiraEmail = 'tashila.kumara@1billiontech.com';
  const credentials = `${jiraEmail}:${jiraToken.trim()}`;
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;
  const response = await fetch(`${url}/rest/api/3/search/jql?jql=project="${jiraProjectKey.trim()}"&fields=summary,description,issuetype`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jira API request failed with status ${response.status}: ${errorText}`);
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

projectsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const statusQuery = req.query.status as 'active' | 'archived' | undefined;
      const searchQuery = req.query.search as string | undefined;

      const pagination = parsePagination(req);
      if (pagination) {
        const { page, limit } = pagination;
        const result = (await projectsService.listProjects(
          page,
          limit,
          statusQuery,
          searchQuery
        )) as { projects: ProjectRowWithOwner[]; totalCount: number };
        const totalPages = Math.ceil(result.totalCount / limit);
        return res.json({
          projects: result.projects,
          totalCount: result.totalCount,
          page,
          limit,
          totalPages,
        });
      }

      const projects = await projectsService.listProjects();
      res.json({ projects });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list projects';
      res.status(500).json({ error: message });
    }
  }
);

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
      });
      res.status(201).json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create project';
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
      const project = await projectsService.updateProject(
        req.userId!,
        id,
        parsed.data
      );
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.patch(
  '/:id/soft-delete',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      const project = await projectsService.softDeleteProject(req.userId!, id);
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to soft delete project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.patch(
  '/:id/restore',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      const project = await projectsService.restoreProject(req.userId!, id);
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore project';
      res.status(500).json({ error: message });
    }
  }
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

projectsRouter.get(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    try {
      const project = await projectsService.getProjectById(id);
      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to retrieve project';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.get(
  '/:id/members',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    try {
      const members = await projectsService.listMembers(id);
      res.json({ members });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve project members';
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

projectsRouter.post(
  '/jira/preview',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.body;
    let { jiraUrl, jiraToken, jiraProjectKey } = req.body;

if (jiraToken === undefined) {
  jiraToken = process.env.JIRA_API_TOKEN;
}

    try {
      if (projectId && (!jiraUrl || !jiraToken || !jiraProjectKey)) {
        const project = await projectsService.getProjectById(projectId);
        if (project) {
          jiraUrl = jiraUrl || project.jira_url;
          jiraToken = jiraToken || project.jira_token;
          jiraProjectKey = jiraProjectKey || project.jira_project_key;
        }
      }

      // Fall back to global settings if still missing URL/Token
      if (!jiraUrl || !jiraToken) {
        const globalSettings = await projectsService.getJiraSettings(req.userId!);
        if (globalSettings) {
          jiraUrl = jiraUrl || globalSettings.jira_url;
          jiraToken = jiraToken || globalSettings.jira_token;
        }
      }

      if (!jiraUrl || !jiraToken || !jiraProjectKey) {
        return res.status(400).json({ error: 'Jira URL, Token, and Project Key are required' });
      }

      const issues = await fetchAndParseJiraIssues(jiraUrl, jiraToken, jiraProjectKey);
      res.json({ issues });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Jira connection test failed';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.post(
  '/jira/import',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.body;
    let { jiraUrl, jiraToken, jiraProjectKey } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

if (jiraToken === undefined) {
  jiraToken = process.env.JIRA_API_TOKEN;
}

    try {
      if (!jiraUrl || !jiraToken || !jiraProjectKey) {
        const project = await projectsService.getProjectById(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        jiraUrl = jiraUrl || project.jira_url;
        jiraToken = jiraToken || project.jira_token;
        jiraProjectKey = jiraProjectKey || project.jira_project_key;
      }

      // Fall back to global settings if still missing URL/Token
      if (!jiraUrl || !jiraToken) {
        const globalSettings = await projectsService.getJiraSettings(req.userId!);
        if (globalSettings) {
          jiraUrl = jiraUrl || globalSettings.jira_url;
          jiraToken = jiraToken || globalSettings.jira_token;
        }
      }

      if (!jiraUrl || !jiraToken || !jiraProjectKey) {
        return res.status(400).json({ error: 'Jira integration is not configured. Please provide credentials or set up global settings.' });
      }

      // Get existing work items for this project to prevent duplication
      const { data: existingWorkItems } = await supabase
        .from('work_items')
        .select('jira_issue_key')
        .eq('project_id', projectId)
        .not('jira_issue_key', 'is', null);

      const existingKeys = new Set<string>(
        (existingWorkItems || [])
          .map((item: { jira_issue_key: string | null }) => item.jira_issue_key)
          .filter((key: string | null): key is string => !!key)
      );

      const issues = await fetchAndParseJiraIssues(jiraUrl, jiraToken, jiraProjectKey);

      let importedCount = 0;
      for (const issue of issues) {
        if (existingKeys.has(issue.key)) {
          continue; // Skip already imported issue to prevent duplication
        }

        const workItemInput: WorkItemBody = {
          title: issue.title,
          project_id: projectId,
          type: issue.type,
          assignee_id: null,
          due_date: null,
          description: issue.description || null,
          jira_issue_key: issue.key,
        };

        await workItems.workItemService.createWorkItem(req.userId!, workItemInput);
        importedCount++;
      }

      res.json({ success: true, importedCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Jira import failed';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.get(
  '/jira/settings',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await projectsService.getJiraSettings(req.userId!);
      if (!settings) {
        return res.json({ configured: false });
      }
      res.json({
        configured: true,
        jiraUrl: settings.jira_url,
        jiraEmail: settings.jira_email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch settings';
      res.status(500).json({ error: message });
    }
  }
);

projectsRouter.put(
  '/jira/settings',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const { jiraUrl, jiraEmail, jiraToken } = req.body;
    if (!jiraUrl || !jiraEmail || !jiraToken) {
      return res.status(400).json({ error: 'Jira URL, Email, and Token are required' });
    }

    try {
      await projectsService.saveJiraSettings(req.userId!, jiraUrl, jiraEmail, jiraToken);
      res.json({ success: true, jiraUrl, jiraEmail });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      res.status(500).json({ error: message });
    }
  }
);

export default projectsRouter;
