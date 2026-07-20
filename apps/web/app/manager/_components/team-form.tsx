'use client';

import { FormAlertMessage } from '@/app/_shared/form-alert-message';
import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Users,
  Loader2,
  X,
} from '@repo/ui/lib/icons';
import type { User } from '@/app/users/_services/users.service';
import { createTeam, updateTeam } from '../_services/teams.service';
import {
  getProjectList,
  getProjectMembers,
  type Project,
  type ProjectMemberWithUser,
} from '@/app/projects/_services/projects.service';
import type { Team } from '../_services/teams.service';

interface ProjectMembersListProps {
  isLoadingMembers: boolean;
  projectMembers: ProjectMemberWithUser[];
  selectedMemberIds: string[];
  setSelectedMemberIds: React.Dispatch<React.SetStateAction<string[]>>;
}

function ProjectMembersList({
  isLoadingMembers,
  projectMembers,
  selectedMemberIds,
  setSelectedMemberIds,
}: Readonly<ProjectMembersListProps>) {
  if (isLoadingMembers) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading project members...
      </div>
    );
  }

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
        const isChecked = selectedMemberIds.includes(m.user_id);
        const checkboxId = `member-checkbox-${m.user_id}`;
        return (
          <div
            key={m.user_id}
            className="hover:bg-accent/50 flex items-center gap-3 rounded px-2.5 py-1.5 transition-colors"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={isChecked}
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

async function findBestProjectForTeamMembers(
  currentMemberIds: string[],
  activeProjects: Project[]
): Promise<string> {
  if (currentMemberIds.length === 0) return '';

  let bestProjectId = '';
  let maxOverlap = 0;

  for (const proj of activeProjects) {
    try {
      const projMembers = await getProjectMembers(proj.id);
      const projMemberIds = new Set(projMembers.map((pm) => pm.user_id));
      const overlap = currentMemberIds.filter((id: string) =>
        projMemberIds.has(id)
      ).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestProjectId = proj.id;
      }
    } catch (err) {
      console.error(`Failed to fetch members for project ${proj.id}:`, err);
    }
  }

  return bestProjectId;
}

interface TeamFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly teamToEdit?: Team | null;
  readonly users: User[];
}


export function TeamForm({
  onClose,
  onSuccess,
  teamToEdit = null,
  users,
}: Readonly<TeamFormProps>) {
  const editActionActive = !!teamToEdit;
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectMembers, setProjectMembers] = useState<ProjectMemberWithUser[]>(
    []
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    const initEditData = async () => {
      setIsLoadingProjects(true);
      try {
        const list = await getProjectList();
        const activeProjects = list.filter((p) => p.status === 'active');
        setProjects(activeProjects);

        if (editActionActive && teamToEdit?.members) {
          const currentMemberIds = teamToEdit.members.map(
            (m: { user_id: string }) => m.user_id
          );
          setSelectedMemberIds(currentMemberIds);

          const bestProjectId = await findBestProjectForTeamMembers(
            currentMemberIds,
            activeProjects
          );
          if (bestProjectId) {
            setSelectedProjectId(bestProjectId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    initEditData();
  }, [editActionActive, teamToEdit]);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchMembers = async () => {
        setIsLoadingMembers(true);
        try {
          const membersList = await getProjectMembers(selectedProjectId);
          setProjectMembers(
            membersList.filter((m) => m.status === 'active' && m.user)
          );
        } catch (err) {
          console.error('Failed to fetch project members:', err);
        } finally {
          setIsLoadingMembers(false);
        }
      };
      fetchMembers();
    } else {
      setProjectMembers([]);
    }
  }, [selectedProjectId]);

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

    try {
      const teamData = {
        name: name.trim(),
        tech_stack: techStack.trim() || null,
        description: description.trim() || null,
        manager_id: managerId,
        status: status,
        member_ids: selectedMemberIds,
      };

      if (editActionActive && teamToEdit) {
        await updateTeam(teamToEdit.id, teamData);
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
            {/* Team Identifier / Name */}
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

            {/* Primary Technology Stack */}
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

            {/* Team Status */}
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
                  className="bg-background/80 h-10 w-full"
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

            {/* Role Description */}
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

            {/* Designated Team Manager */}
            <div className="space-y-2">
              <Label htmlFor="manager_id" className="text-sm font-medium">
                Designated Team Manager
              </Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger
                  id="manager_id"
                  className="bg-background/80 h-10 w-full"
                >
                  <SelectValue placeholder="Select Manager..." />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.role === 'manager' || u.role === 'admin')
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Associated Project */}
            <div className="space-y-2">
              <Label htmlFor="project_id" className="text-sm font-medium">
                Associated Project
              </Label>
              <select
                id="project_id"
                name="project_id"
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedMemberIds([]);
                }}
                className="bg-background/80 border-input text-foreground focus-visible:ring-primary focus:border-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="">
                  {isLoadingProjects
                    ? 'Loading projects...'
                    : 'Select Project...'}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            {/* Project Members to Add to Team */}
            {selectedProjectId && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">
                  Project Members to Add to Team
                </Label>
                <ProjectMembersList
                  isLoadingMembers={isLoadingMembers}
                  projectMembers={projectMembers}
                  selectedMemberIds={selectedMemberIds}
                  setSelectedMemberIds={setSelectedMemberIds}
                />
              </div>
            )}
          </div>

          <FormAlertMessage message={message} isError={isError} />

          <div className="flex gap-3 pt-2">
            {onClose && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || isSuccess}
                onClick={onClose}
                className="w-1/3"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className={`${onClose ? 'w-2/3' : 'w-full'}`}
            >
              {buttonLabelContent}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
