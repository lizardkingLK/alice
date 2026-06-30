'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { toggleUserActive } from './actions';
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
  UserPlus
} from 'lucide-react';
import type { Tables } from '@repo/types';

type DbUser = Tables<'users'>;

interface UserRegistryProps {
  readonly users: DbUser[];
  readonly currentUserId?: string | null;
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

export function UserRegistry({ users, currentUserId }: Readonly<UserRegistryProps>) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
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
        if (!result.success) {
          setError(result.error || 'Failed to activate user.');
        } else {
          setError(null);
        }
      });
    }
  };

  const confirmDeactivation = () => {
    if (!deactivatingUser) return;

    startTransition(async () => {
      const result = await toggleUserActive(deactivatingUser.id, false);
      if (!result.success) {
        setError(result.error || 'Failed to deactivate user.');
      } else {
        setDeactivatingUser(null);
        setError(null);
      }
    });
  };

  return (
    <>
      <Card className="border-border bg-card/50 backdrop-blur-md shadow-lg relative">
        {error && (
          <div className="absolute top-4 right-4 left-4 z-10 text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="ml-auto text-xs hover:underline focus:outline-none cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Users className="text-primary h-5 w-5" />
              User Registry
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              View all registered team members, their system roles, and activation status.
            </CardDescription>
          </div>
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="cursor-pointer inline-flex items-center justify-center rounded-md h-9 px-4 text-xs shadow-md hover:shadow-lg transition-all duration-300"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add User
          </button>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
              <Users className="h-8 w-8 stroke-1 text-muted-foreground/50 animate-bounce" />
              <p>No registered users found in database.</p>
              <p className="text-xs text-muted-foreground/75">Create one using the button to get started.</p>
            </div>
          ) : (
            <div className="divide-border divide-y">
              {users.map((usr) => {
                const isSelf = usr.id === currentUserId;
                const isDeactivating = isPending && deactivatingUser?.id === usr.id;
                return (
                  <div
                    key={usr.id}
                    className="group flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold border shadow-sm transition-all duration-300 group-hover:scale-105 ${
                        usr.active 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-muted text-muted-foreground border-muted-foreground/20'
                      }`}>
                        {getAvatarPlaceholder(usr.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-semibold leading-none transition-colors flex items-center gap-2 ${
                          usr.active ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground line-through'
                        }`}>
                          {usr.name}
                          {isSelf && (
                            <span className="text-[10px] bg-primary/25 border border-primary/30 text-primary px-1.5 py-0.2 rounded-full normal-case tracking-normal">
                              You
                            </span>
                          )}
                        </h4>
                        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{usr.email}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 pl-13 sm:pl-0">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${getRoleBadgeStyles(usr.role)}`}>
                        <Shield className="h-3 w-3" />
                        {usr.role}
                      </span>
                      
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        usr.active 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {usr.active ? 'Active' : 'Inactive'}
                      </span>

                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(usr.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </span>

                      {!isSelf && (
                        <button
                          disabled={isPending}
                          onClick={() => handleToggleActive(usr)}
                          className={`cursor-pointer inline-flex items-center justify-center rounded-md h-8 px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            usr.active 
                              ? 'bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/20' 
                              : 'bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-500/20'
                          }`}
                        >
                          {isDeactivating && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {!isDeactivating && usr.active && (
                            <>
                              <UserX className="h-3 w-3 mr-1" />
                              Deactivate
                            </>
                          )}
                          {!isDeactivating && !usr.active && (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-500 mb-3">
                <div className="bg-rose-500/10 p-2 rounded-full border border-rose-500/20">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Confirm Deactivation</h3>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to deactivate <strong className="text-foreground">{deactivatingUser.name}</strong> ({deactivatingUser.email})?
              </p>
              <p className="text-xs text-muted-foreground/80 mt-2 bg-muted/50 p-2.5 rounded-lg border border-border/40">
                They will immediately lose access to their dashboard, workspace resources, and any active sessions.
              </p>

              {error && (
                <div className="mt-4 text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="bg-muted/40 border-t border-border px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeactivatingUser(null)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmDeactivation}
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 hover:bg-rose-700 px-4 text-xs font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <UserForm 
              onClose={() => setIsAddUserOpen(false)} 
              onSuccess={() => setIsAddUserOpen(false)} 
            />
          </div>
        </div>
      )}
    </>
  );
}

