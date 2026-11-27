'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/ui/radio-group';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Search, UserPlus } from '@repo/ui/lib/icons';
import { SearchableSelect } from '@/components/searchable-select';
import { ProjectFormQuickCreateUser } from '@/app/projects/_components/project-form-quick-create-user';
import type { User } from '@/app/users/_services/users.mutations.client';
import { isProductUsableUser } from '@repo/types';

export type Step5TeamProps = {
  projectMemberIds: string[];
  setProjectMemberIds: Dispatch<SetStateAction<string[]>>;
  selectedOwnerId: string;
  setSelectedOwnerId: Dispatch<SetStateAction<string>>;
  users: User[];
  // eslint-disable-next-line no-unused-vars -- callback docs
  onUserCreated: (user: User) => void;
  createInitialTeam: boolean;
  setCreateInitialTeam: Dispatch<SetStateAction<boolean>>;
  teamName: string;
  setTeamName: Dispatch<SetStateAction<string>>;
  teamDescription: string;
  setTeamDescription: Dispatch<SetStateAction<string>>;
  teamManagerId: string;
  setTeamManagerId: Dispatch<SetStateAction<string>>;
  teamTechStack: string;
  setTeamTechStack: Dispatch<SetStateAction<string>>;
  teamMemberIds: string[];
  setTeamMemberIds: Dispatch<SetStateAction<string[]>>;
};

function matchesMemberSearch(user: User, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    user.name.toLowerCase().includes(needle) ||
    user.email.toLowerCase().includes(needle)
  );
}

function TeamMembersChecklist({
  eligibleUsers,
  filteredMembers,
  teamMemberIds,
  setTeamMemberIds,
}: Readonly<{
  eligibleUsers: User[];
  filteredMembers: User[];
  teamMemberIds: string[];
  setTeamMemberIds: Dispatch<SetStateAction<string[]>>;
}>) {
  if (eligibleUsers.length === 0) {
    return <p className="text-muted-foreground text-sm">No users available.</p>;
  }

  if (filteredMembers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No members match your search.
      </p>
    );
  }

  return filteredMembers.map((user) => (
    <label key={user.id} className="flex cursor-pointer items-center gap-3">
      <Checkbox
        checked={teamMemberIds.includes(user.id)}
        onCheckedChange={(checked) => {
          setTeamMemberIds(
            checked === true
              ? [...new Set([...teamMemberIds, user.id])]
              : teamMemberIds.filter((id) => id !== user.id)
          );
        }}
      />
      <span className="text-sm">
        {user.name} ({user.email})
      </span>
    </label>
  ));
}

function ProjectMembersPicker({
  eligibleUsers,
  filteredMembers,
  projectMemberIds,
  selectedOwnerId,
  setProjectMemberIds,
  setSelectedOwnerId,
}: Readonly<{
  eligibleUsers: User[];
  filteredMembers: User[];
  projectMemberIds: string[];
  selectedOwnerId: string;
  setProjectMemberIds: Dispatch<SetStateAction<string[]>>;
  setSelectedOwnerId: Dispatch<SetStateAction<string>>;
}>) {
  if (eligibleUsers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No users available. Quick-create a manager to continue.
      </p>
    );
  }

  if (filteredMembers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No members match your search.
      </p>
    );
  }

  const handleMemberCheckedChange = (userId: string, next: boolean) => {
    if (next) {
      setProjectMemberIds((prev) => [...new Set([...prev, userId])]);
      return;
    }
    setProjectMemberIds((prev) => prev.filter((id) => id !== userId));
    if (selectedOwnerId === userId) {
      setSelectedOwnerId('');
    }
  };

  const handleOwnerChange = (ownerId: string) => {
    setSelectedOwnerId(ownerId);
    setProjectMemberIds((prev) =>
      prev.includes(ownerId) ? prev : [...prev, ownerId]
    );
  };

  return (
    <RadioGroup
      value={selectedOwnerId}
      onValueChange={handleOwnerChange}
      className="gap-1"
    >
      {filteredMembers.map((user) => {
        const checked = projectMemberIds.includes(user.id);
        const memberId = `project-member-${user.id}`;
        const ownerId = `project-owner-${user.id}`;
        return (
          <div
            key={user.id}
            className="hover:bg-accent/40 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2"
          >
            <Checkbox
              id={memberId}
              checked={checked}
              onCheckedChange={(next) =>
                handleMemberCheckedChange(user.id, next === true)
              }
            />
            <Label htmlFor={memberId} className="min-w-0 cursor-pointer">
              <TruncatedText className="text-sm font-medium">
                {user.name}
              </TruncatedText>
              <TruncatedText className="text-muted-foreground text-xs">
                {`${user.email} · ${user.role}`}
              </TruncatedText>
            </Label>
            <div className="flex w-16 flex-col items-center gap-1">
              <RadioGroupItem
                id={ownerId}
                value={user.id}
                aria-label={`Mark ${user.name} as owner`}
              />
              <Label
                htmlFor={ownerId}
                className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase"
              >
                Owner
              </Label>
            </div>
          </div>
        );
      })}
    </RadioGroup>
  );
}

export function Step5Team({
  projectMemberIds,
  setProjectMemberIds,
  selectedOwnerId,
  setSelectedOwnerId,
  users,
  onUserCreated,
  createInitialTeam,
  setCreateInitialTeam,
  teamName,
  setTeamName,
  teamDescription,
  setTeamDescription,
  teamManagerId,
  setTeamManagerId,
  teamTechStack,
  setTeamTechStack,
  teamMemberIds,
  setTeamMemberIds,
}: Readonly<Step5TeamProps>) {
  const [memberSearch, setMemberSearch] = useState('');
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const eligibleUsers = useMemo(
    () => users.filter(isProductUsableUser),
    [users]
  );
  const filteredProjectMembers = useMemo(
    () =>
      eligibleUsers.filter((user) => matchesMemberSearch(user, memberSearch)),
    [eligibleUsers, memberSearch]
  );
  const filteredTeamMembers = useMemo(
    () =>
      eligibleUsers.filter((user) =>
        matchesMemberSearch(user, teamMemberSearch)
      ),
    [eligibleUsers, teamMemberSearch]
  );

  const handleUserCreated = (user: User) => {
    onUserCreated(user);
    setProjectMemberIds((prev) => [...new Set([...prev, user.id])]);
    setSelectedOwnerId(user.id);
    setQuickCreateOpen(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-6 duration-300">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Project members</Label>
          <p className="text-muted-foreground text-xs">
            Select members and mark one owner. At least one manager is required.
          </p>
        </div>

        <div className="flex max-w-sm items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              id="project_members_search"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Search members…"
              className="h-8 pl-8 text-sm"
              aria-label="Search project members"
            />
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 cursor-pointer"
                  aria-label="Quick create user"
                  onClick={() => setQuickCreateOpen(true)}
                >
                  <UserPlus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Quick create user and invite
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="h-56 space-y-1 overflow-y-auto rounded-md border p-2">
          <div className="text-muted-foreground bg-background sticky top-0 z-10 grid grid-cols-[auto_1fr_auto] gap-3 px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
            <span className="w-4" />
            <span>Member</span>
            <span className="w-16 text-center">Owner</span>
          </div>
          <ProjectMembersPicker
            eligibleUsers={eligibleUsers}
            filteredMembers={filteredProjectMembers}
            projectMemberIds={projectMemberIds}
            selectedOwnerId={selectedOwnerId}
            setProjectMemberIds={setProjectMemberIds}
            setSelectedOwnerId={setSelectedOwnerId}
          />
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="create_initial_team"
            checked={createInitialTeam}
            onCheckedChange={(checked) =>
              setCreateInitialTeam(checked === true)
            }
          />
          <Label htmlFor="create_initial_team" className="font-medium">
            Create an initial team
          </Label>
        </div>
        <p className="text-muted-foreground text-xs">
          Optional. Skip this to create the project without a team.
        </p>
      </div>

      {createInitialTeam ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team_name">Team Name</Label>
            <Input
              id="team_name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="e.g. Development Team"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_description">Description</Label>
            <Textarea
              id="team_description"
              value={teamDescription}
              onChange={(event) => setTeamDescription(event.target.value)}
              placeholder="What does this team work on?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_manager">Team Manager</Label>
            <SearchableSelect
              id="team_manager"
              value={teamManagerId}
              onValueChange={setTeamManagerId}
              placeholder="Select a team manager"
              options={eligibleUsers
                .filter(
                  (user) => user.role === 'admin' || user.role === 'manager'
                )
                .map((user) => ({
                  value: user.id,
                  label: `${user.name} (${user.email})`,
                }))}
              emptyText="No matching managers."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_tech_stack">Technology Stack</Label>
            <Input
              id="team_tech_stack"
              value={teamTechStack}
              onChange={(event) => setTeamTechStack(event.target.value)}
              placeholder="e.g. React, Node.js, PostgreSQL"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="team_members_search">Team Members</Label>
              <div className="relative max-w-[14rem] min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  id="team_members_search"
                  value={teamMemberSearch}
                  onChange={(event) => setTeamMemberSearch(event.target.value)}
                  placeholder="Search members…"
                  className="h-8 pl-8 text-sm"
                  aria-label="Search team members"
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Select users to add to the new team.
            </p>

            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
              <TeamMembersChecklist
                eligibleUsers={eligibleUsers}
                filteredMembers={filteredTeamMembers}
                teamMemberIds={teamMemberIds}
                setTeamMemberIds={setTeamMemberIds}
              />
            </div>
          </div>
        </div>
      ) : null}

      <ProjectFormQuickCreateUser
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={handleUserCreated}
      />
    </div>
  );
}
