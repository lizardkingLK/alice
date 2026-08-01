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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Users, Loader2, X } from '@repo/ui/lib/icons';
import type { User } from '@/app/users/_services/users.service';
import { createTeam, updateTeam } from '../_services/teams.service';
import type {
  Project,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from '@/app/projects/_services/projects.service.base';
import type { Team } from '../_services/teams.service';

interface ProjectMembersListProps {
  projectMembers: ProjectMemberWithUser[];
  selectedMemberIds: string[];
  setSelectedMemberIds: React.Dispatch<React.SetStateAction<string[]>>;
}

function ProjectMembersList({
  projectMembers,
  selectedMemberIds,
  setSelectedMemberIds,
}: Readonly<ProjectMembersListProps>) {
  if (projectMembers.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 border-border/50 rounded-lg border p-3 text-xs">
        No active members found in this project.
      </div>
    );
  }

  return (
    <div className="bg-background/50 border-input custom-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
      {projectMembers.map((m) => {
        const isMember = selectedMemberIds.includes(m.user_id);
        const checkboxId = `member-checkbox-${m.user_id}`;
        return (
          <div
            key={m.user_id}
            className="hover:bg-accent/50 flex items-center gap-3 rounded px-2.5 py-1.5 transition-colors"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={isMember}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedMemberIds([...selectedMemberIds, m.user_id]);
                } else {
                  setSelectedMemberIds(
                    selectedMemberIds.filter((id: string) => id !== m.user_id)
                  );
                }
              }}
              className="accent-primary h-4 w-4 cursor-pointer rounded"
            />
            <label
              htmlFor={checkboxId}
              className="flex flex-1 cursor-pointer flex-col"
            >
              <span className="text-foreground text-xs font-semibold">
                {m.user?.name}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {m.user?.email} • {m.user?.role}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

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
      const teamData = {
        name: name.trim(),
        tech_stack: techStack.trim() || null,
        description: description.trim() || null,
        manager_id: managerId,
        project_id: selectedProjectId,
        status: status,
        member_ids: selectedMemberIds,
      };

      if (editActionActive && teamToEdit) {
        await updateTeam(teamToEdit.id, {
          name: teamData.name,
          tech_stack: teamData.tech_stack,
          description: teamData.description,
          manager_id: teamData.manager_id,
          status: teamData.status,
          member_ids: teamData.member_ids,
          // Persist project when repairing legacy rows that were saved without one.
          ...(teamToEdit.project_id ? {} : { project_id: teamData.project_id }),
        });
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
                <ProjectMembersList
                  projectMembers={projectMembers}
                  selectedMemberIds={selectedMemberIds}
                  setSelectedMemberIds={setSelectedMemberIds}
                />
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
