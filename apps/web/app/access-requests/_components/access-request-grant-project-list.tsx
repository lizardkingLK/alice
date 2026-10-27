'use client';

import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Label } from '@repo/ui/components/ui/label';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { AccessRequestProjectKeyBadges } from '@/app/access-requests/_components/access-request-project-key-badges';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { GrantProjectSelection } from '@/lib/access-requests/grant-project-selection';

type AccessRequestGrantProjectListProps = {
  readonly entryId: string;
  readonly projects: readonly Project[];
  readonly selections: readonly GrantProjectSelection[];
  readonly memberLocked: boolean;
  readonly isPending: boolean;
  // eslint-disable-next-line no-unused-vars -- callback docs
  readonly onGrantChange: (projectId: string, granted: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onMemberChange: (projectId: string, addMember: boolean) => void;
};

export function AccessRequestGrantProjectList({
  entryId,
  projects,
  selections,
  memberLocked,
  isPending,
  onGrantChange,
  onMemberChange,
}: Readonly<AccessRequestGrantProjectListProps>) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no accessible projects to grant.
      </p>
    );
  }

  return (
    <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
      <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-3 px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
        <span>Project</span>
        <span className="w-14 text-center">Grant</span>
        <span className="w-16 text-center">Member</span>
      </div>
      {selections.map((row) => {
        const project = projectById.get(row.projectId);
        if (!project) {
          return null;
        }
        const grantId = `grant-${entryId}-${row.projectId}`;
        const memberId = `member-${entryId}-${row.projectId}`;
        return (
          <div
            key={row.projectId}
            className="hover:bg-accent/40 grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md px-2 py-2"
          >
            <div className="min-w-0 space-y-0.5">
              <TruncatedText className="text-sm font-semibold">
                {project.name}
              </TruncatedText>
              <AccessRequestProjectKeyBadges keys={[project.key]} />
            </div>
            <div className="flex w-14 justify-center">
              <Checkbox
                id={grantId}
                checked={row.granted}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  onGrantChange(row.projectId, checked === true)
                }
              />
              <Label htmlFor={grantId} className="sr-only">
                Grant {project.key}
              </Label>
            </div>
            <div className="flex w-16 justify-center">
              <Checkbox
                id={memberId}
                checked={row.addMember}
                disabled={isPending || memberLocked || !row.granted}
                onCheckedChange={(checked) =>
                  onMemberChange(row.projectId, checked === true)
                }
              />
              <Label htmlFor={memberId} className="sr-only">
                Add as member of {project.key}
              </Label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
