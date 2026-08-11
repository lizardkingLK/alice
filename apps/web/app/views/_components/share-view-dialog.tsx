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
import {
  fetchShareViewProjectScope,
  type ShareViewMemberOption,
  type ShareViewTeamOption,
} from '@/lib/form-read-actions';
import {
  shareSavedView,
  type SavedView,
} from '@/app/views/_services/saved-views.client';

type ProjectOption = {
  readonly id: string;
  readonly name: string;
};

type ShareViewDialogProps = {
  readonly view: SavedView | null;
  readonly open: boolean;
  readonly projects: ReadonlyArray<ProjectOption>;
  // eslint-disable-next-line no-unused-vars -- dialog open change callback
  readonly onOpenChange: (open: boolean) => void;
};

type RecipientsSelectorProps = {
  readonly projectId: string;
  readonly loadingOptions: boolean;
  readonly members: readonly ShareViewMemberOption[];
  readonly selectedUserIds: readonly string[];
  // eslint-disable-next-line no-unused-vars -- selection change callback
  readonly onSelectedUserIdsChange: (userIds: string[]) => void;
  readonly pending: boolean;
  readonly ownerId: string | null;
};

function replaceSelectedIds(
  candidateIds: readonly string[],
  ownerId: string | null | undefined
): string[] {
  return [
    ...new Set(candidateIds.filter((id) => Boolean(id) && id !== ownerId)),
  ];
}

function RecipientsSelector({
  projectId,
  loadingOptions,
  members,
  selectedUserIds,
  onSelectedUserIdsChange,
  pending,
  ownerId,
}: Readonly<RecipientsSelectorProps>) {
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
      checkboxIdPrefix="share-member"
      disabled={pending}
      excludeUserIds={ownerId ? [ownerId] : undefined}
      listClassName="max-h-64"
    />
  );
}

export function ShareViewDialog({
  view,
  open,
  projects,
  onOpenChange,
}: Readonly<ShareViewDialogProps>) {
  const lockedProjectId = view?.project_id ?? null;
  const ownerId = view?.owner_id ?? null;

  const [projectId, setProjectId] = useState('');
  const [teams, setTeams] = useState<ShareViewTeamOption[]>([]);
  const [teamId, setTeamId] = useState('');
  const [members, setMembers] = useState<ShareViewMemberOption[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const projectLocked = Boolean(lockedProjectId);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProjectId(lockedProjectId ?? '');
    setTeamId('');
    setTeams([]);
    setMembers([]);
    setSelectedUserIds([]);
    setError(null);
  }, [lockedProjectId, open, view?.id]);

  useEffect(() => {
    if (!open || !projectId) {
      setTeams([]);
      setMembers([]);
      setSelectedUserIds([]);
      return;
    }

    let cancelled = false;
    const loadProjectScope = async () => {
      setLoadingOptions(true);
      setError(null);
      try {
        const scope = await fetchShareViewProjectScope(projectId);
        if (cancelled) {
          return;
        }

        setMembers(scope.members);
        setTeams(scope.teams);
        setTeamId('');
        setSelectedUserIds(
          replaceSelectedIds(
            scope.members.map((member) => member.userId),
            ownerId
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load share recipients'
          );
          setMembers([]);
          setTeams([]);
          setSelectedUserIds([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void loadProjectScope();
    return () => {
      cancelled = true;
    };
  }, [open, ownerId, projectId]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    [projects]
  );

  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        value: team.id,
        label: team.name,
      })),
    [teams]
  );

  const handleProjectChange = (nextProjectId: string) => {
    if (projectLocked) {
      return;
    }
    setProjectId(nextProjectId);
    setTeamId('');
  };

  const handleTeamChange = (nextTeamId: string) => {
    setTeamId(nextTeamId);
    if (!nextTeamId) {
      setSelectedUserIds(
        replaceSelectedIds(
          members.map((member) => member.userId),
          ownerId
        )
      );
      return;
    }
    const team = teams.find((item) => item.id === nextTeamId);
    const memberIdSet = new Set(members.map((member) => member.userId));
    setSelectedUserIds(
      replaceSelectedIds(
        (team?.memberUserIds ?? []).filter((id) => memberIdSet.has(id)),
        ownerId
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!view) {
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Select at least one recipient.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await shareSavedView(view.id, {
        userIds: selectedUserIds,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share view');
    } finally {
      setPending(false);
    }
  };

  const shareDisabled =
    pending || !view || !projectId || selectedUserIds.length === 0;

  const visibleMemberCount = ownerId
    ? members.filter((member) => member.userId !== ownerId).length
    : members.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden sm:max-w-lg"
        dismissOnOutsideClick={false}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Share view</DialogTitle>
            <DialogDescription>
              {view
                ? `Share “${view.title}” and notify selected recipients.`
                : 'Share a saved view.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-project">Project</Label>
              <SearchableSelect
                id="share-project"
                ariaLabel="Project"
                options={projectOptions}
                value={projectId}
                onValueChange={handleProjectChange}
                placeholder="Select a project"
                disabled={projectLocked || pending}
                emptyText="No projects found."
              />
              {projectLocked ? (
                <p className="text-muted-foreground text-xs">
                  Locked to this view’s project.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-team">Team</Label>
              <SearchableSelect
                id="share-team"
                ariaLabel="Team"
                options={teamOptions}
                value={teamId}
                onValueChange={handleTeamChange}
                placeholder={
                  projectId ? 'All project members' : 'Select a project first'
                }
                disabled={!projectId || loadingOptions || pending}
                emptyText="No teams for this project."
                showClear
              />
            </div>

            <div className="flex min-h-0 flex-col gap-1.5">
              <Label>Recipients</Label>
              <RecipientsSelector
                projectId={projectId}
                loadingOptions={loadingOptions}
                members={members}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={setSelectedUserIds}
                pending={pending}
                ownerId={ownerId}
              />
              {projectId && visibleMemberCount > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {selectedUserIds.length} selected. Changing project or team
                  replaces the selection.
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={shareDisabled}>
              {pending ? 'Sharing…' : 'Share'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
