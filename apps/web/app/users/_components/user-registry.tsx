'use client';

import { useEffect, useState } from 'react';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { UserForm } from './user-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import {
  Users,
  Mail,
  Shield,
  Calendar,
  UserCheck,
  UserX,
  Loader2,
  AlertTriangle,
  UserPlus,
  Pencil,
} from '@repo/ui/lib/icons';
import { toggleUserActive } from '../_services/users.service';
import { CustomSpinner } from '@/app/users/_components/user-spinner';
import { Pagination } from '@/components/pagination';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import type { User } from '../_services/users.service';

interface UserRegistryProps {
  readonly users: User[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

function getRoleBadgeStyles(role: string) {
  switch (role) {
    case 'admin':
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    case 'manager':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    default:
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  }
}

function getAvatarPlaceholder(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserRegistry({
  users,
  totalCount,
  page,
  limit,
  totalPages,
  currentUserId,
  currentUserRole,
}: Readonly<UserRegistryProps>) {
  const { handlePageChange, handleLimitChange, router } =
    usePaginationNavigation(totalPages, limit);

  const [mounted, setMounted] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleActive = (user: User) => {
    if (user.active) {
      // Trigger confirmation modal for deactivation
      setDeactivatingUser(user);
      setError(null);
    } else {
      // Activate immediately
      setIsTogglingActive(true);
      toggleUserActive(user.id, true)
        .then(() => {
          setError(null);
          router.refresh();
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Failed to activate user.';
          setError(message);
        })
        .finally(() => {
          setIsTogglingActive(false);
        });
    }
  };

  const confirmDeactivation = () => {
    if (!deactivatingUser) return;

    setIsTogglingActive(true);
    toggleUserActive(deactivatingUser.id, false)
      .then(() => {
        setDeactivatingUser(null);
        setError(null);
        router.refresh();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to deactivate user.';
        setError(message);
      })
      .finally(() => {
        setIsTogglingActive(false);
      });
  };

  return (
    <>
      <Card className="border-border bg-card/50 relative backdrop-blur-md">
        {error && (
          <div className="text-destructive bg-destructive/10 border-destructive/20 absolute top-4 right-4 left-4 z-10 flex items-center gap-2 rounded-lg border p-3 text-sm">
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
        )}

        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Users className="text-primary h-5 w-5" />
              User Registry
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              View all registered team members, their system roles, and
              activation status.
            </CardDescription>
          </div>
          {currentUserRole === 'admin' && (
            <Button
              onClick={() => setIsAddUserOpen(true)}
              className="flex h-10 w-32 shrink-0 items-center justify-center px-6 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              Add User
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
              <Users className="text-muted-foreground/50 h-8 w-8 animate-bounce stroke-1" />
              <p>No registered users found in database.</p>
              <p className="text-muted-foreground/75 text-xs">
                Create one using the button to get started.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">User</TableHead>
                      <TableHead className="w-[15%]">Role</TableHead>
                      <TableHead className="w-[12%]">Status</TableHead>
                      <TableHead className="w-[18%]">Joined Date</TableHead>
                      <TableHead className="w-[20%] pr-4">
                        <div className="flex justify-end">
                          <div className="w-50 text-left">Actions</div>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((usr) => (
                      <UserRegistryRow
                        key={usr.id}
                        usr={usr}
                        currentUserId={currentUserId}
                        currentUserRole={currentUserRole}
                        isTogglingActive={isTogglingActive}
                        deactivatingUser={deactivatingUser}
                        mounted={mounted}
                        setEditingUser={setEditingUser}
                        handleToggleActive={handleToggleActive}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                totalCount={totalCount}
                page={page}
                limit={limit}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                label="users"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {deactivatingUser && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <dialog
            open
            className="bg-card border-border animate-in fade-in zoom-in-95 relative block w-full max-w-md overflow-hidden rounded-xl border shadow-2xl duration-200"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="mb-3 flex items-center gap-3 text-rose-500">
                <div className="rounded-full border border-rose-500/20 bg-rose-500/10 p-2">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-foreground text-lg font-bold">
                  Confirm Deactivation
                </h3>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
                Are you sure you want to deactivate{' '}
                <strong className="text-foreground">
                  {deactivatingUser.name}
                </strong>{' '}
                ({deactivatingUser.email})?
              </p>
              <p className="text-muted-foreground/80 bg-muted/50 border-border/40 mt-2 rounded-lg border p-2.5 text-xs">
                They will immediately lose access to their dashboard, workspace
                resources, and any active sessions.
              </p>

              {error && (
                <div className="text-destructive bg-destructive/10 border-destructive/20 mt-4 flex items-center gap-2 rounded-lg border p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={isTogglingActive}
                onClick={() => setDeactivatingUser(null)}
                className="h-9 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isTogglingActive}
                onClick={confirmDeactivation}
                className="bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50"
              >
                {isTogglingActive ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate User'
                )}
              </Button>
            </div>
          </dialog>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <UserForm
              onClose={() => setIsAddUserOpen(false)}
              onSuccess={() => {
                setIsAddUserOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <UserForm
              user={editingUser}
              onClose={() => setEditingUser(null)}
              onSuccess={() => {
                setEditingUser(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* eslint-disable no-unused-vars */
interface UserRegistryRowProps {
  readonly usr: User;
  readonly currentUserId: string | null | undefined;
  readonly currentUserRole: string | null | undefined;
  readonly isTogglingActive: boolean;
  readonly deactivatingUser: User | null;
  readonly mounted: boolean;
  readonly setEditingUser: (usr: User) => void;
  readonly handleToggleActive: (usr: User) => void;
}
/* eslint-enable no-unused-vars */

function formatJoinedDate(createdAt: string, mounted: boolean) {
  if (!mounted) return <CustomSpinner />;
  return (
    <div className="flex items-center gap-1">
      <Calendar className="h-3 w-3 shrink-0" />
      <span>
        {new Date(createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    </div>
  );
}

function UserRegistryRow({
  usr,
  currentUserId,
  currentUserRole,
  isTogglingActive,
  deactivatingUser,
  mounted,
  setEditingUser,
  handleToggleActive,
}: UserRegistryRowProps) {
  const isSelf = usr.id === currentUserId;
  const isDeactivating = isTogglingActive && deactivatingUser?.id === usr.id;

  // Extract action buttons to avoid nested conditional JSX (SonarQube compliance)
  let primaryButton = <div className="w-20 shrink-0" />;
  if (currentUserRole === 'admin') {
    primaryButton = (
      <Button
        variant="outline"
        disabled={isTogglingActive}
        onClick={() => setEditingUser(usr)}
        className="focus-visible:ring-ring flex h-8 w-20 shrink-0 items-center justify-center border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 shadow-sm transition-all hover:bg-emerald-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        <Pencil className="mr-1 h-3 w-3 shrink-0" />
        <span>Edit</span>
      </Button>
    );
  }

  let secondaryButton = <div className="w-28 shrink-0" />;
  if (currentUserRole === 'admin' && !isSelf) {
    let buttonContent;
    if (isDeactivating) {
      buttonContent = <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />;
    } else if (usr.active) {
      buttonContent = (
        <>
          <UserX className="mr-1 h-3.5 w-3.5 shrink-0" />
          <span>Deactivate</span>
        </>
      );
    } else {
      buttonContent = (
        <>
          <UserCheck className="mr-1 h-3.5 w-3.5 shrink-0" />
          <span>Activate</span>
        </>
      );
    }

    secondaryButton = (
      <Button
        disabled={isTogglingActive}
        onClick={() => handleToggleActive(usr)}
        className={cn(
          'focus-visible:ring-ring flex h-8 w-28 shrink-0 items-center justify-center border text-[11px] font-medium shadow-sm transition-all focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50',
          usr.active
            ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white'
            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white'
        )}
      >
        {buttonContent}
      </Button>
    );
  }

  return (
    <TableRow className="hover:bg-accent/40 h-16">
      <TableCell className="w-[35%] font-medium">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold shadow-sm transition-all duration-300 ${
              usr.active
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground border-muted-foreground/20'
            }`}
          >
            {getAvatarPlaceholder(usr.name)}
          </div>
          <div className="min-w-0">
            <div
              className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                usr.active
                  ? 'text-foreground hover:text-primary'
                  : 'text-muted-foreground line-through'
              }`}
            >
              <span className="truncate">{usr.name}</span>
              {isSelf && (
                <span className="bg-primary/25 border-primary/30 text-primary py-0.2 shrink-0 rounded-full border px-1.5 text-[9px] tracking-normal normal-case">
                  You
                </span>
              )}
            </div>
            <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{usr.email}</span>
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="w-[15%]">
        <span
          className={cn(
            'inline-flex h-6 w-24 shrink-0 items-center justify-center gap-1 rounded-full border text-[10px] font-semibold uppercase',
            getRoleBadgeStyles(usr.role)
          )}
        >
          <Shield className="h-3 w-3 shrink-0" />
          <span>{usr.role}</span>
        </span>
      </TableCell>
      <TableCell className="w-[12%]">
        <span
          className={cn(
            'inline-flex h-6 w-24 shrink-0 items-center justify-center gap-1 rounded-full border text-[10px] font-semibold uppercase',
            usr.active
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-500'
          )}
        >
          <span>{usr.active ? 'Active' : 'Inactive'}</span>
        </span>
      </TableCell>
      <TableCell className="w-[18%]">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          {formatJoinedDate(usr.created_at, mounted)}
        </div>
      </TableCell>
      <TableCell className="w-[20%] pr-4 text-right">
        <div className="flex justify-end gap-2">
          {primaryButton}
          {secondaryButton}
        </div>
      </TableCell>
    </TableRow>
  );
}
