'use client';

import { ProjectIntegrationsMarketplace } from '@/app/projects/_components/project-details/project-integrations-marketplace';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

export type ProjectIntegrationsTabProps = {
  readonly project: Project;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly canEditProject?: boolean;
};

export function ProjectIntegrationsTab({
  project,
  currentUserId,
  currentUserRole,
  canEditProject = true,
}: Readonly<ProjectIntegrationsTabProps>) {
  return (
    <ProjectIntegrationsMarketplace
      project={project}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      canEditProject={canEditProject}
    />
  );
}
