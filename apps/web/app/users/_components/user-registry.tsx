'use client';

import { useState, useTransition } from 'react';
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
} from 'lucide-react';
import type { Tables } from '@repo/types';
import { toggleUserActive } from './actions';

type DbUser = Tables<'users'>;

interface UserRegistryProps {
  readonly users: DbUser[];
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
  currentUserId,
  currentUserRole,
}: Readonly<UserRegistryProps>) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<DbUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggleActive = (user: DbUser) => {
    if (user.active) {
      // Trigger confirmation modal for deactivation
      setDeactivatingUser(user);
      setError(null);
    } else {
      // Activate immediately
      startTransition(async () => {
        const result = await toggleUserActive(user.id, true);
        if (result.success) {
          setError(null);
        } else {
          setError(result.error || 'Failed to activate user.');
        }
      });
    }
  };

  const confirmDeactivation = () => {
    if (!deactivatingUser) return;

    startTransition(async () => {
      const result = await toggleUserActive(deactivatingUser.id, false);
      if (result.success) {
        setDeactivatingUser(null);
        setError(null);
      } else {
        setError(result.error || 'Failed to deactivate user.');
      }
    });
  };

  return (
    <>
      <Card className="border-border bg-card/50 relative backdrop-blur-md">
        {error && (
          <div className="text-destructive bg-destructive/10 border-destructive/20 absolute top-4 right-4 left-4 z-10 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto cursor-pointer text-xs hover:underline focus:outline-none"
            >
              Dismiss
            </button>
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
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/95 inline-flex h-10 cursor-pointer items-center justify-center rounded-md px-4 text-xs font-semibold shadow-md transition-all duration-300 hover:shadow-lg"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Add User
            </button>
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
            <div className="divide-border divide-y">
              {users.map((usr) => {
                const isSelf = usr.id === currentUserId;
                const isDeactivating =
                  isPending && deactivatingUser?.id === usr.id;
                return (
                  <div
                    key={usr.id}
                    className="group flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold shadow-sm transition-all duration-300 group-hover:scale-105 ${
                          usr.active
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted text-muted-foreground border-muted-foreground/20'
                        }`}
                      >
                        {getAvatarPlaceholder(usr.name)}
                      </div>
                      <div className="min-w-0">
                        <h4
                          className={`flex items-center gap-2 text-sm leading-none font-semibold transition-colors ${
                            usr.active
                              ? 'text-foreground group-hover:text-primary'
                              : 'text-muted-foreground line-through'
                          }`}
                        >
                          {usr.name}
                          {isSelf && (
                            <span className="bg-primary/25 border-primary/30 text-primary py-0.2 rounded-full border px-1.5 text-[10px] tracking-normal normal-case">
                              You
                            </span>
                          )}
                        </h4>
                        <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{usr.email}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-13 sm:gap-4 sm:pl-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase ${getRoleBadgeStyles(usr.role)}`}
                      >
                        <Shield className="h-3 w-3" />
                        {usr.role}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase ${
                          usr.active
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                            : 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {usr.active ? 'Active' : 'Inactive'}
                      </span>

                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Calendar className="h-3 w-3" />
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
                      </span>

                      {currentUserRole === 'admin' && (
                        <button
                          disabled={isPending}
                          onClick={() => setEditingUser(usr)}
                          className="border-input bg-background hover:bg-accent text-foreground focus-visible:ring-ring inline-flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none"
                        >
                          Edit
                        </button>
                      )}

                      {currentUserRole === 'admin' && !isSelf && (
                        <button
                          disabled={isPending}
                          onClick={() => handleToggleActive(usr)}
                          className={`focus-visible:ring-ring inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-3 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none ${
                            usr.active
                              ? 'border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white'
                              : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                          }`}
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
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeactivatingUser(null)}
                className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md border px-4 text-xs font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmDeactivation}
                className="focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate User'
                )}
              </button>
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
              onSuccess={() => setIsAddUserOpen(false)}
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
              onSuccess={() => setEditingUser(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
