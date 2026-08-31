'use client';

import { useState, type FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Edit } from '@repo/ui/lib/icons';
import { REPORT_CARD_CLASS } from '@/app/projects/[id]/_components/project-details-shared';
import { GitHubLogo } from '@/app/projects/[id]/_components/integration-brand-logos';
import {
  IntegrationEditForm,
  IntegrationFeedbackBanner,
  IntegrationSummaryFields,
} from '@/app/projects/[id]/_components/integration-settings-shared';
import { GithubRepoFields } from '@/app/projects/_components/github-repo-fields';
import { useIntegrationSettingsSave } from '@/app/projects/_hooks/use-integration-settings-save';
import {
  formatGithubRepoPath,
  parseGithubRepoPath,
} from '@/lib/projects/github-repo-path';
import type { Project } from '../../_services/projects.mutations.client';

export type GithubSettingsCardProps = {
  readonly project: Project;
};

export function GithubSettingsCard({
  project,
}: Readonly<GithubSettingsCardProps>) {
  const initial = parseGithubRepoPath(project.github_repo);
  const [isEditingGithub, setIsEditingGithub] = useState(!project.github_repo);
  const [githubOwner, setGithubOwner] = useState(initial.owner);
  const [githubRepoName, setGithubRepoName] = useState(initial.repoName);
  // Write-only: never prefill the PAT from the server.
  const [githubToken, setGithubToken] = useState('');

  const {
    isSaving: isSavingGithub,
    message: githubMessage,
    isError: isGithubError,
    clearFeedback,
    save,
  } = useIntegrationSettingsSave({
    projectId: project.id,
    expectedUpdatedAt: project.updated_at,
    successMessage: 'GitHub integration settings saved successfully!',
    logLabel: 'Failed to save GitHub integration:',
    onSuccess: () => {
      setIsEditingGithub(false);
      setGithubToken('');
    },
  });

  const handleCancelEdit = () => {
    const parts = parseGithubRepoPath(project.github_repo);
    setGithubOwner(parts.owner);
    setGithubRepoName(parts.repoName);
    setGithubToken('');
    setIsEditingGithub(false);
    clearFeedback();
  };

  const handleSaveGithub = async (e: FormEvent) => {
    e.preventDefault();
    const repoPath = formatGithubRepoPath(githubOwner, githubRepoName);
    const body: Record<string, unknown> = {
      github_repo: repoPath,
    };
    // Write-only: omit empty token to leave existing PAT unchanged.
    if (githubToken.trim()) {
      body.github_token = githubToken.trim();
    } else if (!repoPath) {
      body.github_token = null;
    }
    await save(body);
  };

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
          <GitHubLogo />
          GitHub Integration
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configure your GitHub repository to link Pull Requests, view commits,
          and track branches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner
          message={githubMessage}
          isError={isGithubError}
        />

        {isEditingGithub ? (
          <IntegrationEditForm
            onSubmit={handleSaveGithub}
            showCancel={Boolean(project.github_repo)}
            onCancel={handleCancelEdit}
            isSaving={isSavingGithub}
            saveLabel="Save GitHub Configuration"
          >
            <GithubRepoFields
              githubOwner={githubOwner}
              setGithubOwner={setGithubOwner}
              githubRepoName={githubRepoName}
              setGithubRepoName={setGithubRepoName}
              githubToken={githubToken}
              setGithubToken={setGithubToken}
              tokenPlaceholder={
                project.has_github_token
                  ? 'Leave blank to keep existing token'
                  : 'e.g. ghp_xxxxxxxxxxxx'
              }
            />
          </IntegrationEditForm>
        ) : (
          <div className="space-y-4">
            <IntegrationSummaryFields
              fields={[
                {
                  label: 'GitHub Repository',
                  value: project.github_repo || 'Not configured',
                },
                {
                  label: 'Access Token',
                  value: project.has_github_token
                    ? '••••••••••••••••'
                    : 'Not configured (Public repos only)',
                  mono: true,
                },
              ]}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingGithub(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Modify GitHub Settings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
