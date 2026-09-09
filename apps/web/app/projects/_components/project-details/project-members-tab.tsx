'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  AlertTriangle,
  Loader2,
  Trash2,
  UserPlus,
  Users,
} from '@repo/ui/lib/icons';
import { SearchableSelect } from '@/components/searchable-select';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import {
  addProjectMember,
  removeProjectMember,
  type Project,
  type ProjectMemberWithUser,
} from '@/app/projects/_services/projects.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';

function MemberStatusBadge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="bg-primary/20 text-primary py-0.2 shrink-0 rounded-full px-1.5 text-[9px] font-bold uppercase">
      {children}
    </span>
  );
}

function protectedMemberRemoveTitle(params: {
  readonly isOwner: boolean;
  readonly isCreator: boolean;
  readonly userName: string;
}): string {
  if (params.isOwner) {
    return 'Cannot remove the project owner. Change the owner on the project first.';
  }
  if (params.isCreator) {
    return 'Cannot remove the project creator. The admin who created this project stays assigned.';
  }
  return `Remove ${params.userName}`;
}

export type ProjectMembersTabProps = {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
};

export function ProjectMembersTab({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
}: Readonly<ProjectMembersTabProps>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isAddPending, setIsAddPending] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const candidateUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const handleAddMember = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const userId = (formData.get('userId') as string) || selectedUserId;
    if (!userId) {
      setAddError('User selection is required.');
      return;
    }
    setAddError(null);
    setIsAddPending(true);
    try {
      await addProjectMember(project.id, userId);
      form.reset();
      setSelectedUserId('');
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member.');
    } finally {
      setIsAddPending(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setError(null);
    setDeletingUserId(userId);
    try {
      await removeProjectMember(project.id, userId);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to remove member from project.'
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className={`${REPORT_CARD_CLASS} md:col-span-2`}>
        <CardHeader>
          <CardTitle className="text-xl font-bold tracking-tight">
            Allocated Members
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            A list of engineering resources currently assigned to this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="text-destructive bg-destructive/10 border-destructive/20 relative flex items-center gap-2 rounded-lg border p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <Button
                variant="link"
                onClick={() => setError(null)}
                className="text-destructive ml-auto h-auto cursor-pointer p-0 text-xs hover:underline focus:outline-none"
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          {members.length === 0 ? (
            <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm">
              <Users className="text-muted-foreground/45 h-8 w-8 stroke-1" />
              <p>No project members assigned yet.</p>
            </div>
          ) : (
            <div className="divide-border divide-y">
              {members.map((member) => {
                const userName = member.user?.name ?? 'Unknown User';
                const userEmail = member.user?.email ?? '';
                const userRole = member.user?.role ?? 'member';
                const isSelf = member.user_id === currentUserId;
                const isOwner = member.user_id === project.owner_id;
                const isCreator =
                  Boolean(project.created_by) &&
                  member.user_id === project.created_by;
                const isProtectedMember = isOwner || isCreator;

                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-muted text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {userName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          <TruncatedText className="text-foreground min-w-0">
                            {userName}
                          </TruncatedText>
                          <span className="bg-muted border-border text-muted-foreground py-0.2 shrink-0 rounded-full border px-1.5 text-[10px] font-semibold tracking-wider uppercase">
                            {userRole}
                          </span>
                          {isOwner ? (
                            <MemberStatusBadge>Owner</MemberStatusBadge>
                          ) : null}
                          {isCreator && !isOwner ? (
                            <MemberStatusBadge>Creator</MemberStatusBadge>
                          ) : null}
                          {isSelf ? (
                            <MemberStatusBadge>You</MemberStatusBadge>
                          ) : null}
                        </div>
                        {userEmail ? (
                          <TruncatedText className="text-muted-foreground text-xs">
                            {userEmail}
                          </TruncatedText>
                        ) : null}
                      </div>
                    </div>

                    {isManagerOrAdmin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={
                          Boolean(deletingUserId) ||
                          isAddPending ||
                          isProtectedMember
                        }
                        onClick={() => {
                          if (isProtectedMember) {
                            return;
                          }
                          handleRemoveMember(member.user_id);
                        }}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors disabled:opacity-50"
                        title={protectedMemberRemoveTitle({
                          isOwner,
                          isCreator,
                          userName,
                        })}
                      >
                        {deletingUserId === member.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isManagerOrAdmin ? (
        <Card className={`${REPORT_CARD_CLASS} h-fit`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <UserPlus className="text-primary h-5 w-5" />
              Allocate Member
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Assign a new engineering resource to the project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {candidateUsers.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                All available users are already assigned to this project.
              </p>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-1.5">
                  <SearchableSelect
                    id="userId"
                    name="userId"
                    required
                    placeholder="Search users…"
                    ariaLabel="Select user to allocate"
                    className="bg-background border-input h-10 w-full"
                    options={candidateUsers.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.email})`,
                    }))}
                    emptyText="No matching users."
                  />
                </div>

                {addError ? (
                  <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-1.5 rounded-lg border p-2.5 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={isAddPending}
                  className="w-full cursor-pointer font-semibold shadow-md transition-shadow hover:shadow-lg"
                >
                  {isAddPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Allocating...
                    </>
                  ) : (
                    'Add to Project'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
