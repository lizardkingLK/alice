'use client';

import { JiraSettingsCard } from '@/app/projects/[id]/_components/jira-settings-card';
import { GithubSettingsCard } from '@/app/projects/[id]/_components/github-settings-card';
import type { Project } from '../../_services/projects.service';

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
