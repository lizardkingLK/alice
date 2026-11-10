'use client';

import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  Plus,
  Trash2,
  Users,
} from '@repo/ui/lib/icons';
import { DataTable } from '@/components/data-table';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { SearchInput } from '@/components/search-input';
import { SearchableSelect } from '@/components/searchable-select';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { UserAvatar } from '@/components/user-avatar';
import { UserRoleEnum } from '@repo/types';
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

type MemberRow = {
  readonly member: ProjectMemberWithUser;
  readonly userName: string;
  readonly userEmail: string;
  readonly userRole: string;
  readonly isSelf: boolean;
  readonly isOwner: boolean;
  readonly isCreator: boolean;
};

export function ProjectMembersTab({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
}: Readonly<ProjectMembersTabProps>) {
  const router = useRouter();
  const { isUserOnline } = useRealtime();
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    readonly userId: string;
    readonly userName: string;
  } | null>(null);
  const [isAddPending, setIsAddPending] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const isManagerOrAdmin =
    currentUserRole === UserRoleEnum.admin ||
    currentUserRole === UserRoleEnum.manager;

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const candidateUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const rows = useMemo<MemberRow[]>(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return members
      .map((member) => {
        const userName = member.user?.name ?? 'Unknown User';
        const userEmail = member.user?.email ?? '';
        const userRole = member.user?.role ?? 'member';
        return {
          member,
          userName,
          userEmail,
          userRole,
          isSelf: member.user_id === currentUserId,
          isOwner: member.user_id === project.owner_id,
          isCreator:
            Boolean(project.created_by) &&
            member.user_id === project.created_by,
        };
      })
      .filter((row) => {
        if (!normalized) {
          return true;
        }
        return (
          row.userName.toLowerCase().includes(normalized) ||
          row.userEmail.toLowerCase().includes(normalized) ||
          row.userRole.toLowerCase().includes(normalized)
        );
      });
  }, [
    members,
    searchQuery,
    currentUserId,
    project.owner_id,
    project.created_by,
  ]);

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
      setIsAddOpen(false);
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member.');
    } finally {
      setIsAddPending(false);
    }
  };

  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove) {
      return;
    }
    const { userId } = memberToRemove;
    setError(null);
    setDeletingUserId(userId);
    try {
      await removeProjectMember(project.id, userId);
      setMemberToRemove(null);
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
  }, [memberToRemove, project.id, router]);

  const columns = useMemo<ColumnDef<MemberRow>[]>(() => {
    const cols: ColumnDef<MemberRow>[] = [
      {
        id: 'member',
        header: 'Member',
        cell: ({ row }) => {
          const {
            member,
            userName,
            userEmail,
            userRole,
            isSelf,
            isOwner,
            isCreator,
          } = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar
                name={userName}
                title={userName}
                isOnline={isUserOnline(member.user_id)}
                className="size-8 border-0 after:border-0 data-[size=sm]:size-8"
                fallbackClassName="bg-muted text-foreground text-xs font-bold"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold">
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
                  {isSelf ? <MemberStatusBadge>You</MemberStatusBadge> : null}
                </div>
                {userEmail ? (
                  <TruncatedText className="text-muted-foreground text-xs">
                    {userEmail}
                  </TruncatedText>
                ) : null}
              </div>
            </div>
          );
        },
      },
    ];

    if (isManagerOrAdmin) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const { member, userName, isOwner, isCreator } = row.original;
          const isProtectedMember = isOwner || isCreator;
          return (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={
                  Boolean(deletingUserId) || isAddPending || isProtectedMember
                }
                onClick={() => {
                  if (isProtectedMember) {
                    return;
                  }
                  setMemberToRemove({
                    userId: member.user_id,
                    userName,
                  });
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
            </div>
          );
        },
      });
    }

    return cols;
  }, [isManagerOrAdmin, deletingUserId, isAddPending, isUserOnline]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.member.user_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search members by name, email, or role…"
          />
        </div>

        {isManagerOrAdmin ? (
          <Button
            type="button"
            onClick={() => {
              setAddError(null);
              setIsAddOpen(true);
            }}
            className="flex h-10 w-36 shrink-0 cursor-pointer items-center justify-center rounded-lg px-6 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
            title="Add member"
          >
            <Plus className="mr-1.5 h-4 w-4 shrink-0" />
            Add Member
          </Button>
        ) : null}
      </div>

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

      <Card className="border-border/60 bg-card/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Users className="text-primary h-5 w-5" />
            Project Members
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            People who can open this project workspace and its work items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            table={table}
            columnCount={columns.length}
            rowClassName="hover:bg-accent/40 h-16"
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2">
                <FolderOpen className="text-muted-foreground/50 h-8 w-8 stroke-1" />
                <p>
                  {searchQuery.trim()
                    ? 'No members found matching the search.'
                    : 'No project members assigned yet.'}
                </p>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setAddError(null);
            setSelectedUserId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Assign an existing workspace user to this project.
            </DialogDescription>
          </DialogHeader>
          {candidateUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              All available users are already assigned to this project.
            </p>
          ) : (
            <form onSubmit={handleAddMember} className="space-y-4">
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
                value={selectedUserId || undefined}
                onValueChange={setSelectedUserId}
              />

              {addError ? (
                <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-1.5 rounded-lg border p-2.5 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isAddPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isAddPending}>
                  {isAddPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    'Add to Project'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {memberToRemove ? (
        <RegistryConfirmDialog
          title="Remove Member"
          subject={memberToRemove.userName}
          detail="They will lose access to this project workspace until they are added again."
          confirmLabel="Remove Member"
          pendingLabel="Removing…"
          isPending={deletingUserId === memberToRemove.userId}
          isSoft
          actionVerb="remove"
          onCancel={() => {
            if (deletingUserId) {
              return;
            }
            setMemberToRemove(null);
          }}
          onConfirm={() => {
            void confirmRemoveMember();
          }}
        />
      ) : null}
    </div>
  );
}
