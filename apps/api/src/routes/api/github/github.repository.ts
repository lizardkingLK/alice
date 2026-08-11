import { supabase } from '../../../lib/supabase';

export type GitHubSettingsRow = {
  github_owner: string | null;
  github_repo: string | null;
  github_token: string | null;
};

export class GitHubRepository {
  async getProjectGitHubSettings(projectId: string): Promise<GitHubSettingsRow | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('github_owner, github_repo, github_token')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error('database error get project github settings:', error.message);
      throw new Error('Failed to retrieve project GitHub settings');
    }

    return data;
  }

  async updateProjectGitHubSettings(
    projectId: string,
    settings: {
      github_owner?: string | null;
      github_repo?: string | null;
      github_token?: string | null;
    }
  ): Promise<GitHubSettingsRow> {
    const { data, error } = await supabase
      .from('projects')
      .update({
        github_owner: settings.github_owner ?? null,
        github_repo: settings.github_repo ?? null,
        github_token: settings.github_token ?? null,
      })
      .eq('id', projectId)
      .select('github_owner, github_repo, github_token')
      .single();

    if (error) {
      console.error('database error update project github settings:', error.message);
      throw new Error(`Failed to update project GitHub settings: ${error.message}`);
    }

    return data;
  }

  async getWorkItemWithProject(workItemId: string): Promise<{
    id: string;
    project_id: string;
    jira_issue_key: string | null;
    github_prs: unknown;
  } | null> {
    const { data, error } = await supabase
      .from('work_items')
      .select('id, project_id, jira_issue_key, github_prs')
      .eq('id', workItemId)
      .maybeSingle();

    if (error) {
      console.error('database error get work item with project:', error.message);
      throw new Error('Failed to retrieve work item data');
    }

    return data;
  }
}
