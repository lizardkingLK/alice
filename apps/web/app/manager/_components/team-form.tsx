'use client';

import { FormCancelSubmitActions } from '@/components/form-cancel-submit-actions';
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { SearchableSelect } from '@/components/searchable-select';
import { MemberCheckboxList } from '@/components/member-checkbox-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Users, Loader2, X } from '@repo/ui/lib/icons';
import type { User } from '@/app/users/_services/users.mutations.client';
import { createTeam, updateTeam } from '../_services/teams.mutations.client';
import type {
  Project,
  ProjectMembersByProjectId,
} from '@/app/projects/_services/projects.mutations.shared';
import type { Team } from '../_services/teams.mutations.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';

interface TeamFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly teamToEdit?: Team | null;
  readonly users: User[];
  readonly activeProjects: Project[];
  readonly projectMembersByProjectId: ProjectMembersByProjectId;
  readonly lockedProjectId?: string;
}

export function TeamForm({
  onClose,
  onSuccess,
  teamToEdit = null,
  users,
  activeProjects,
  projectMembersByProjectId,
  lockedProjectId,
}: Readonly<TeamFormProps>) {
  const editActionActive = !!teamToEdit;
  const { handleMutationError } = useOptimisticLock();
  // Lock once a project is stored; allow picking one when legacy rows have null.
  const projectLocked =
    Boolean(lockedProjectId) ||
    (editActionActive && Boolean(teamToEdit?.project_id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [name, setName] = useState(teamToEdit?.name ?? '');
  const [techStack, setTechStack] = useState(teamToEdit?.tech_stack ?? '');
  const [description, setDescription] = useState(teamToEdit?.description ?? '');
  const [managerId, setManagerId] = useState(teamToEdit?.manager_id ?? '');
  const [status, setStatus] = useState<'active' | 'inactive' | 'archived'>(
    teamToEdit?.status && teamToEdit?.status !== 'deleted'
      ? teamToEdit.status
      : 'active'
  );

  const [selectedProjectId, setSelectedProjectId] = useState(
    lockedProjectId ?? teamToEdit?.project_id ?? ''
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    () =>
      teamToEdit?.members
        ?.filter((member) => member.status === 'active')
        .map((member) => member.user_id) ?? []
  );

  const [memberCapacities, setMemberCapacities] = useState<Record<string, number>>(() => {
    const capacities: Record<string, number> = {};
    if (teamToEdit?.members) {
      for (const m of teamToEdit.members) {
        capacities[m.user_id] = m.capacity ?? 40;
      }
    }
    return capacities;
  });

  const [memberAllocations, setMemberAllocations] = useState<Record<string, number>>(() => {
    const allocations: Record<string, number> = {};
    if (teamToEdit?.members) {
      for (const m of teamToEdit.members) {
        allocations[m.user_id] = m.allocation ?? 100;
      }
    }
    return allocations;
  });

  const projectOptions = useMemo(() => {
    if (
      !projectLocked ||
      !selectedProjectId ||
      activeProjects.some((project) => project.id === selectedProjectId)
    ) {
      return activeProjects;
    }

    // Keep locked project visible even if it is no longer in the active list.
    return [
      {
        id: selectedProjectId,
        name: 'Associated project',
        key: '—',
      } as Project,
      ...activeProjects,
    ];
  }, [activeProjects, projectLocked, selectedProjectId]);

  // Prefetched project members are the checkbox options. Selected team members
  // missing from that list (orphans) are appended so checks remain visible.
  const projectMembers = useMemo(() => {
    const fromProject = selectedProjectId
      ? (projectMembersByProjectId[selectedProjectId] ?? [])
      : [];
    const byUserId = new Map(
      fromProject.map((member) => [member.user_id, member])
    );

    for (const userId of selectedMemberIds) {
      if (byUserId.has(userId)) {
        continue;
      }
      const user = users.find((entry) => entry.id === userId);
      byUserId.set(userId, {
        project_id: selectedProjectId || 'unknown',
        user_id: userId,
        status: 'active',
        created_at: '',
        user: {
          id: userId,
          name: user?.name ?? 'Unknown user',
          email: user?.email ?? '',
          role: user?.role ?? 'member',
          profile_picture: user?.profile_picture ?? null,
        },
      });
    }

    return [...byUserId.values()];
  }, [selectedProjectId, projectMembersByProjectId, selectedMemberIds, users]);

  const memberCheckboxOptions = useMemo(
    () =>
      projectMembers.map((member) => ({
        userId: member.user_id,
        name: member.user?.name ?? member.user_id,
        email: member.user?.email ?? '',
        role: member.user?.role ?? '',
      })),
    [projectMembers]
  );

  const showMembersSection =
    Boolean(selectedProjectId) ||
    (editActionActive && selectedMemberIds.length > 0);

  const handleProjectChange = (projectId: string) => {
    if (projectLocked) {
      return;
    }
    setSelectedProjectId(projectId);
    // Create: reset members for the new project. Edit (null project_id recovery):
    // keep existing team members checked while loading the project's roster.
    if (!editActionActive) {
      setSelectedMemberIds([]);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    if (!name.trim() || !managerId || !status) {
      setMessage('Team name, manager, and status are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    if (!selectedProjectId) {
      setMessage('Associated project is required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const membersPayload = selectedMemberIds.map((userId) => ({
        user_id: userId,
        capacity: memberCapacities[userId] ?? 40,
        allocation: memberAllocations[userId] ?? 100,
      }));

      const teamData = {
        name: name.trim(),
        tech_stack: techStack.trim() || null,
        description: description.trim() || null,
        manager_id: managerId,
        project_id: selectedProjectId,
        status: status,
        member_ids: selectedMemberIds,
        members: membersPayload,
      };

      if (editActionActive && teamToEdit) {
        const teamPayload = {
          name: teamData.name,
          tech_stack: teamData.tech_stack,
          description: teamData.description,
          manager_id: teamData.manager_id,
          status: teamData.status,
          member_ids: teamData.member_ids,
          members: teamData.members,
          ...(teamToEdit.project_id ? {} : { project_id: teamData.project_id }),
        };
        const expectedUpdatedAt = teamToEdit.updated_at;

        const updated = await runLockedMutationOrThrow({
          mutate: () =>
            updateTeam(teamToEdit.id, teamPayload, expectedUpdatedAt),
          handleMutationError,
          entityType: 'team',
          entityId: teamToEdit.id,
          expectedUpdatedAt,
          pendingFields: teamPayload,
        });
        if (!updated) {
          return;
        }
        setMessage('The team configuration has been successfully updated.');
      } else {
        await createTeam(teamData);
        setMessage('A new team record has been successfully registered.');
      }

      setIsSuccess(true);
    } catch (error) {
      const modeText = editActionActive ? 'update' : 'create';
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${modeText} team.`;
      setMessage(errorMessage);
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onSuccess?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess]);

  let buttonLabelContent;
  if (isSubmitting) {
    buttonLabelContent = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {editActionActive ? 'Updating team details...' : 'Creating new team...'}
      </>
    );
  } else {
    buttonLabelContent = editActionActive ? 'Save Changes' : 'Create Team';
  }

  const projectSelectInfo = useMemo(() => {
    if (projectLocked) {
      return 'Project is fixed for this team. Toggle members within this project only.';
    } else if (editActionActive) {
      return 'This team has no project yet. Select one to load and manage members.';
    }

    return 'Required. Members are chosen from this project and saved with the team.';
  }, [projectLocked, editActionActive]);

  return (
    <Card className="border-border bg-card text-card-foreground custom-scrollbar relative max-h-[90vh] overflow-y-auto border shadow-2xl transition-all duration-300">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px !important;
          height: 4px !important;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3) !important;
          border-radius: 9999px !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.6) !important;
        }
      `,
        }}
      />
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground absolute top-4 right-4 h-8 w-8 cursor-pointer rounded-full transition-colors"
          aria-label="Dismiss form"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="text-primary h-5 w-5" />
          {editActionActive ? 'Modify Team Configuration' : 'Register New Team'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {editActionActive
            ? 'Update the settings, tech stack, and manager of the selected team.'
            : 'Register a new engineering team workspace to organize resources.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Team Identifier / Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Platform Team"
                required
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech_stack" className="text-sm font-medium">
                Primary Technology Stack
              </Label>
              <Input
                id="tech_stack"
                name="tech_stack"
                placeholder="e.g. Next.js, Node, Postgres"
                value={techStack}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setTechStack(e.target.value)
                }
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">
                Team Status
              </Label>
              <Select
                value={status}
                onValueChange={(val) =>
                  setStatus(val as 'active' | 'inactive' | 'archived')
                }
              >
                <SelectTrigger
                  id="status"
                  className="bg-background/80 h-10 w-full cursor-pointer"
                >
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Role Description
              </Label>
              <Input
                id="description"
                name="description"
                placeholder="e.g. Core team responsible for monorepo and API infrastructure"
                value={description}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setDescription(e.target.value)
                }
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager_id" className="text-sm font-medium">
                Designated Team Manager
              </Label>
              <SearchableSelect
                id="manager_id"
                value={managerId}
                onValueChange={setManagerId}
                placeholder="Search managers…"
                className="bg-background/80 h-10 w-full"
                options={users
                  .filter((u) => u.role === 'manager' || u.role === 'admin')
                  .map((u) => ({
                    value: u.id,
                    label: `${u.name} (${u.email})`,
                  }))}
                emptyText="No matching managers."
              />
            </div>

            {!lockedProjectId ? (
              <div className="space-y-2">
                <Label htmlFor="project_id" className="text-sm font-medium">
                  Associated Project
                </Label>
                <SearchableSelect
                  id="project_id"
                  value={selectedProjectId}
                  onValueChange={handleProjectChange}
                  disabled={projectLocked}
                  placeholder="Search projects…"
                  className="bg-background/80 h-10 w-full"
                  options={projectOptions.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.key})`,
                  }))}
                  emptyText="No matching projects."
                />
                <p className="text-muted-foreground text-[11px]">
                  {projectSelectInfo}
                </p>
              </div>
            ) : null}

            {showMembersSection && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">
                  Project Members to Add to Team
                </Label>
                <MemberCheckboxList
                  members={memberCheckboxOptions}
                  selectedUserIds={selectedMemberIds}
                  onSelectedUserIdsChange={setSelectedMemberIds}
                />
              </div>
            )}

            {showMembersSection && selectedMemberIds.length > 0 && (
              <div className="space-y-3 sm:col-span-2 border-t border-border/50 pt-4 mt-2">
                <Label className="text-sm font-semibold">
                  Configure Member Capacity & Allocation
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedMemberIds.map((userId) => {
                    const memberObj = memberCheckboxOptions.find((m) => m.userId === userId);
                    if (!memberObj) return null;

                    const currentCapacity = memberCapacities[userId] ?? 40;
                    const currentAllocation = memberAllocations[userId] ?? 100;

                    return (
                      <div key={userId} className="flex items-center justify-between gap-4 p-2 bg-muted/40 rounded-lg border border-border/40">
                        <span className="text-sm font-medium truncate flex-1">{memberObj.name} ({memberObj.email})</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Capacity:</span>
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-16 text-center text-xs p-1"
                              value={currentCapacity}
                              onChange={(e) => {
                                const val = Number.parseInt(e.target.value, 10);
                                setMemberCapacities((prev) => ({
                                  ...prev,
                                  [userId]: Number.isNaN(val) ? 0 : val,
                                }));
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Allocation %:</span>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-16 text-center text-xs p-1"
                              value={currentAllocation}
                              onChange={(e) => {
                                const val = Number.parseInt(e.target.value, 10);
                                setMemberAllocations((prev) => ({
                                  ...prev,
                                  [userId]: Number.isNaN(val) ? 0 : val,
                                }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <FormCancelSubmitActions
            message={message}
            isError={isError}
            isBusy={isSubmitting || isSuccess}
            onCancel={onClose}
            submitLabel={buttonLabelContent}
          />
        </form>
      </CardContent>
    </Card>
  );
}
