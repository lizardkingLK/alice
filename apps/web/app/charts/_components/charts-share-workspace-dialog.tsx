'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import { MemberCheckboxList } from '@/components/member-checkbox-list';
import { SearchableSelect } from '@/components/searchable-select';
import { isSessionExpiredError } from '@/lib/errors/session-expired';
import {
  fetchShareViewProjectScope,
  type ShareViewMemberOption,
  type ShareViewTeamOption,
} from '@/lib/form-read-actions';
import {
  shareChartWorkspace,
  syncChartWorkspaceToApi,
} from '@/app/charts/_services/charts.mutations.client';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';

type ProjectOption = {
  readonly id: string;
  readonly name: string;
};

type ChartsShareWorkspaceDialogProps = {
  readonly workspace: ChartWorkspaceRecord | null;
  readonly open: boolean;
  readonly projects: ReadonlyArray<ProjectOption>;
  readonly currentUserId: string;
  // eslint-disable-next-line no-unused-vars -- dialog open change
  readonly onOpenChange: (open: boolean) => void;
};

function replaceSelectedIds(
  candidateIds: readonly string[],
  ownerId: string
): string[] {
  return [
    ...new Set(candidateIds.filter((id) => Boolean(id) && id !== ownerId)),
  ];
}

type RecipientsProps = {
  readonly projectId: string;
  readonly loadingOptions: boolean;
  readonly members: readonly ShareViewMemberOption[];
  readonly selectedUserIds: readonly string[];
  // eslint-disable-next-line no-unused-vars -- selection change
  readonly onSelectedUserIdsChange: (userIds: string[]) => void;
  readonly pending: boolean;
  readonly currentUserId: string;
};

function Recipients({
  members,
  selectedUserIds,
  onSelectedUserIdsChange,
  pending,
  currentUserId,
  projectId,
  loadingOptions,
}: Readonly<RecipientsProps>) {
  if (!projectId) {
    return (
      <div className="text-muted-foreground bg-muted/30 border-border/50 rounded-lg border p-3 text-xs">
        Select a project to load members.
      </div>
    );
  }

  if (loadingOptions) {
    return (
      <div className="text-muted-foreground bg-muted/30 border-border/50 rounded-lg border p-3 text-xs">
        Loading members…
      </div>
    );
  }

  return (
    <MemberCheckboxList
      members={members}
      selectedUserIds={selectedUserIds}
      onSelectedUserIdsChange={onSelectedUserIdsChange}
      checkboxIdPrefix="chart-share-member"
      disabled={pending}
      excludeUserIds={[currentUserId]}
      listClassName="max-h-64"
    />
  );
}

export function ChartsShareWorkspaceDialog({
  workspace,
  open,
  projects,
  currentUserId,
  onOpenChange,
}: Readonly<ChartsShareWorkspaceDialogProps>) {
  const [projectId, setProjectId] = useState('');
  const [teams, setTeams] = useState<ShareViewTeamOption[]>([]);
  const [teamId, setTeamId] = useState('');
  const [members, setMembers] = useState<ShareViewMemberOption[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setProjectId('');
    setTeamId('');
    setTeams([]);
    setMembers([]);
    setSelectedUserIds([]);
    setError(null);
    setPending(false);
  }, [open, workspace?.id]);

  useEffect(() => {
    if (!open || !projectId) {
      setTeams([]);
      setMembers([]);
      setTeamId('');
      setSelectedUserIds([]);
      return;
    }

    let cancelled = false;
    setLoadingOptions(true);
    fetchShareViewProjectScope(projectId)
      .then((scope) => {
        if (cancelled) {
          return;
        }
        setTeams(scope.teams);
        setMembers(scope.members);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setTeams([]);
        setMembers([]);
        setError('Failed to load project members.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({ value: project.id, label: project.name })),
    [projects]
  );
  const teamOptions = useMemo(
    () => teams.map((team) => ({ value: team.id, label: team.name })),
    [teams]
  );
  const memberIdSet = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members]
  );

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setTeamId('');
    setSelectedUserIds([]);
    setError(null);
  };

  const handleTeamChange = (nextTeamId: string) => {
    setTeamId(nextTeamId);
    const team = teams.find((item) => item.id === nextTeamId);
    setSelectedUserIds(
      replaceSelectedIds(
        (team?.memberUserIds ?? []).filter((id) => memberIdSet.has(id)),
        currentUserId
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace) {
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Select at least one recipient.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const synced = await syncChartWorkspaceToApi(workspace);
      if (!synced) {
        throw new Error(
          'Could not sync this workspace to the cloud. Apply the charts migration or try again.'
        );
      }
      const result = await shareChartWorkspace({
        chartId: workspace.id,
        userIds: selectedUserIds,
        createSavedViewBookmark: true,
      });
      if (!result) {
        throw new Error('Failed to share workspace.');
      }
      onOpenChange(false);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Failed to share workspace'
      );
    } finally {
      setPending(false);
    }
  };

  const shareDisabled =
    pending || !workspace || !projectId || selectedUserIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden sm:max-w-lg"
        dismissOnOutsideClick={false}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Share workspace</DialogTitle>
            <DialogDescription>
              {workspace
                ? `Share “${workspace.title}” and notify selected recipients.`
                : 'Share a chart workspace.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chart-share-project">Project</Label>
              <SearchableSelect
                id="chart-share-project"
                ariaLabel="Project"
                options={projectOptions}
                value={projectId}
                onValueChange={handleProjectChange}
                placeholder="Select a project"
                disabled={pending}
                emptyText="No projects found."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chart-share-team">Team</Label>
              <SearchableSelect
                id="chart-share-team"
                ariaLabel="Team"
                options={teamOptions}
                value={teamId}
                onValueChange={handleTeamChange}
                placeholder={
                  projectId ? 'Optional team filter' : 'Select a project first'
                }
                disabled={pending || !projectId || loadingOptions}
                emptyText="No teams in this project."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Recipients</Label>
              <Recipients
                projectId={projectId}
                loadingOptions={loadingOptions}
                members={members}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={setSelectedUserIds}
                pending={pending}
                currentUserId={currentUserId}
              />
            </div>

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={shareDisabled}
            >
              {pending ? 'Sharing…' : 'Share'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
