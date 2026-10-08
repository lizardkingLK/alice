'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { SearchableSelect } from '@/components/searchable-select';
import type { User } from '@/app/users/_services/users.mutations.client';
import { isProductUsableUser } from '@repo/types';

export type Step5TeamProps = {
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
  users: User[];
};

export function Step5Team({
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
  users,
}: Readonly<Step5TeamProps>) {
  const eligibleUsers = users.filter(isProductUsableUser);

  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="space-y-2">
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
          Optional. Skip this step to create the project without a team.
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
            <Label>Team Members</Label>
            <p className="text-muted-foreground text-xs">
              Select users to add to the new team.
            </p>

            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
              {eligibleUsers.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No users available.
                </p>
              ) : (
                eligibleUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-3"
                  >
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
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
