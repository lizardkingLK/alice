'use client';

import { ProjectSummaryMetrics } from '@/app/projects/_components/project-details/project-summary-metrics';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

export type ProjectDetailsTabProps = {
  readonly project: Project;
  readonly memberCount: number;
  readonly teamCount: number;
  readonly workItemCount: number;
  readonly sprintCount: number;
  readonly integrationCount: number;
  readonly fieldCount: number;
  readonly isManagerOrAdmin: boolean;
};

export function ProjectDetailsTab({
  project,
  memberCount,
  teamCount,
  workItemCount,
  sprintCount,
  integrationCount,
  fieldCount,
  isManagerOrAdmin,
}: Readonly<ProjectDetailsTabProps>) {
  return (
    <ProjectSummaryMetrics
      projectId={project.id}
      memberCount={memberCount}
      teamCount={teamCount}
      workItemCount={workItemCount}
      sprintCount={sprintCount}
      integrationCount={integrationCount}
      fieldCount={fieldCount}
      isManagerOrAdmin={isManagerOrAdmin}
    />
  );
}
