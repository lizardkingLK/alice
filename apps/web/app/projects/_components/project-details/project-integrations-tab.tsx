'use client';

import { JiraSettingsCard } from '@/app/projects/_components/project-details/jira-settings-card';
import { GithubSettingsCard } from '@/app/projects/_components/project-details/github-settings-card';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

export type ProjectIntegrationsTabProps = {
  readonly project: Project;
};

export function ProjectIntegrationsTab({
  project,
}: Readonly<ProjectIntegrationsTabProps>) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <JiraSettingsCard project={project} />
      <GithubSettingsCard project={project} />
    </div>
  );
}
