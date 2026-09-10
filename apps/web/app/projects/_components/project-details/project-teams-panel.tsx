'use client';

import Link from 'next/link';
import { AlertTriangle } from '@repo/ui/lib/icons';
import { TeamRegistry } from '@/app/manager/_components/team-registry';
import type { Team } from '@/app/manager/_services/teams.mutations.client';
import type {
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_services/projects.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';

type ProjectTeamsPanelProps = {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly teams: Team[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly tab: 'active' | 'inactive' | 'archived';
  readonly search: string;
  readonly users: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
};

export function ProjectTeamsPanel({
  project,
  members,
  teams,
  totalCount,
  page,
  limit,
  totalPages,
  tab,
  search,
  users,
  currentUserId,
  currentUserRole,
}: Readonly<ProjectTeamsPanelProps>) {
  if (members.length === 0) {
    return (
      <div className="border-border/60 bg-card/40 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm backdrop-blur-md">
        <AlertTriangle className="text-muted-foreground/40 mx-auto mb-3 h-8 w-8" />
        <p className="text-foreground font-medium">Add project members first</p>
        <p className="mt-1">
          Teams draw members from the project roster.{' '}
          <Link
            href={`/projects/${project.id}?tab=members`}
            className="text-primary font-medium hover:underline"
          >
            Go to Project Members
          </Link>
        </p>
      </div>
    );
  }

  return (
    <TeamRegistry
      teams={teams}
      totalCount={totalCount}
      page={page}
      limit={limit}
      totalPages={totalPages}
      tab={tab}
      search={search}
      users={users}
      activeProjects={[project]}
      projectMembersByProjectId={{ [project.id]: members }}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      lockedProjectId={project.id}
      statusQueryKey="teamStatus"
      variant="embedded"
    />
  );
}
