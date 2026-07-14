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
} from 'lucide-react';
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
              className="h-10 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
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
              <div className="divide-border divide-y">
                {users.map((usr) => {
                  const isSelf = usr.id === currentUserId;
                  const isDeactivating =
                    isTogglingActive && deactivatingUser?.id === usr.id;
                  return (
                    <div
                      key={usr.id}
                      className="group flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold shadow-sm transition-all duration-300 group-hover:scale-105 ${
                            usr.active
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-muted text-muted-foreground border-muted-foreground/20'
                          }`}
                        >
                          {getAvatarPlaceholder(usr.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className={`flex items-center gap-2 text-sm leading-none font-semibold transition-colors ${
                              usr.active
                                ? 'text-foreground group-hover:text-primary'
                                : 'text-muted-foreground line-through'
                            }`}
                          >
                            <span className="truncate">{usr.name}</span>
                            {isSelf && (
                              <span className="bg-primary/25 border-primary/30 text-primary py-0.2 shrink-0 rounded-full border px-1.5 text-[10px] tracking-normal normal-case">
                                You
                              </span>
                            )}
                          </h4>
                          <span className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1 text-xs">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{usr.email}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-13 sm:grid sm:shrink-0 sm:grid-cols-[110px_90px_120px_90px_120px] sm:items-center sm:gap-3 sm:pl-0">
                        <div className="flex justify-start">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase ${getRoleBadgeStyles(usr.role)}`}
                          >
                            <Shield className="h-3 w-3" />
                            {usr.role}
                          </span>
                        </div>

                        <div className="flex justify-start">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase ${
                              usr.active
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                : 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                            }`}
                          >
                            {usr.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="text-muted-foreground flex items-center justify-start gap-1 text-xs">
                          {mounted ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>
                                {new Date(usr.created_at).toLocaleDateString(
                                  undefined,
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  }
                                )}
                              </span>
                            </div>
                          ) : (
                            <CustomSpinner />
                          )}
                        </div>

                        <div className="flex justify-start">
                          {currentUserRole === 'admin' && (
                            <Button
                              variant="outline"
                              disabled={isTogglingActive}
                              onClick={() => setEditingUser(usr)}
                              className="focus-visible:ring-ring inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] text-emerald-600 font-medium shadow-sm transition-all hover:bg-emerald-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                          )}
                        </div>

                        <div className="flex justify-start">
                          {currentUserRole === 'admin' && !isSelf && (
                            <Button
                              disabled={isTogglingActive}
                              onClick={() => handleToggleActive(usr)}
                              className={cn(
                                'h-8 w-full text-[11px] font-medium shadow-sm transition-all',
                                usr.active
                                  ? 'border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white'
                                  : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                              )}
                            >
                              {isDeactivating && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {!isDeactivating && usr.active && (
                                <>
                                  <UserX className="mr-1 h-3 w-3" />
                                  Deactivate
                                </>
                              )}
                              {!isDeactivating && !usr.active && (
                                <>
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  Activate
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
