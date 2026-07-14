'use client';

import { useState, useTransition, ReactNode, useEffect } from 'react';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { TeamForm } from './team-form';
import { softDeleteTeam, restoreTeam, hardDeleteTeam } from './actions';
import {
  Users,
  Terminal,
  Shield,
  AlertTriangle,
  Loader2,
  Plus,
  Search,
  FolderOpen,
  Pencil,
  Archive,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import type { Team } from '../_services/teams.service';
import type { User } from '@/app/users/_services/users.service';

interface TeamRegistryProps {
  readonly teams: Team[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly tab: 'active' | 'inactive' | 'archived';
  readonly search: string;
  readonly users: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

export function TeamRegistry({
  teams,
  totalCount,
  page,
  limit,
  totalPages,
  tab,
  search,
  users,
  currentUserId,
  currentUserRole,
}: Readonly<TeamRegistryProps>) {
  const {
    handlePageChange,
    handleLimitChange,
    pathname,
    router,
    searchParams,
  } = usePaginationNavigation(totalPages, limit);

  const [searchQuery, setSearchQuery] = useState(search);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';
  const isAdmin = currentUserRole === 'admin';

  // Sync the search query text input to the route parameters using a debounce delay
  useEffect(() => {
    const routeSearchParam = searchParams.get('search') ?? '';
    if (searchQuery.trim() === routeSearchParam.trim()) {
      return;
    }

    const debounceTimer = setTimeout(() => {
      const nextQueryParams = new URLSearchParams(searchParams);
      if (searchQuery) {
        nextQueryParams.set('search', searchQuery);
      } else {
        nextQueryParams.delete('search');
      }
      nextQueryParams.set('page', '1'); // reset page counter to 1
      router.push(`${pathname}?${nextQueryParams.toString()}`);
    }, 450);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, pathname, router, searchParams]);

  const changeTabSelection = (tabKey: 'active' | 'inactive' | 'archived') => {
    const nextQueryParams = new URLSearchParams(searchParams);
    nextQueryParams.set('tab', tabKey);
    nextQueryParams.set('page', '1');
    router.push(`${pathname}?${nextQueryParams.toString()}`);
  };

  const handleSoftDelete = (item: Team) => {
    setTeamToDelete(item);
    setDeleteMode('soft');
    setError(null);
  };

  const handleHardDelete = (item: Team) => {
    setTeamToDelete(item);
    setDeleteMode('hard');
    setError(null);
  };

  const confirmDelete = () => {
    if (teamToDelete === null) return;

    startTransition(async () => {
      const isSoft = deleteMode === 'soft';
      const actionResult = isSoft
        ? await softDeleteTeam(teamToDelete.id)
        : await hardDeleteTeam(teamToDelete.id);

      if (actionResult.success) {
        setTeamToDelete(null);
        setError(null);
        router.refresh();
      } else {
        setError(
          actionResult.error ?? `Operation failed during ${deleteMode} delete.`
        );
      }
    });
  };

  const handleRestore = (item: Team) => {
    setError(null);
    startTransition(async () => {
      const actionResult = await restoreTeam(item.id);
      if (actionResult.success) {
        router.refresh();
      } else {
        setError(actionResult.error ?? 'Unable to restore team.');
      }
    });
  };

  let deleteButtonText: ReactNode;
  if (isPending) {
    deleteButtonText = (
      <>
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        Processing...
      </>
    );
  } else {
    deleteButtonText =
      deleteMode === 'soft' ? 'Archive Team' : 'Delete Permanently';
  }

  let registryDescription =
    'Restore archived teams, or permanently delete them from the database.';
  if (tab === 'active') {
    registryDescription = 'View and manage active software engineering teams.';
  } else if (tab === 'inactive') {
    registryDescription =
      'View and manage temporarily suspended or inactive teams.';
  }

  return (
    <div className="space-y-6">
      {error && (
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
      )}

      {/* Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search teams by name, tech stack, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background/50 h-10 py-2 pr-4 pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
            <Button
              variant="ghost"
              onClick={() => changeTabSelection('active')}
              className={cn(
                'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none',
                tab === 'active'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Active
            </Button>
            <Button
              variant="ghost"
              onClick={() => changeTabSelection('inactive')}
              className={cn(
                'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none',
                tab === 'inactive'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Inactive
            </Button>
            <Button
              variant="ghost"
              onClick={() => changeTabSelection('archived')}
              className={cn(
                'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none',
                tab === 'archived'
                  ? 'bg-background text-foreground hover:bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              )}
            >
              Archived
            </Button>
          </div>

          {isManagerOrAdmin && (
            <Button
              onClick={() => {
                setTeamToEdit(null);
                setIsAddTeamOpen(true);
              }}
              className="h-10 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Team
            </Button>
          )}
        </div>
      </div>

      {/* Teams list */}
      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="text-primary h-5 w-5" />
            Teams Registry
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {registryDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
              <FolderOpen className="text-muted-foreground/50 h-8 w-8 animate-bounce stroke-1" />
              <p>No teams found matching the criteria.</p>
            </div>
          ) : (
            <>
              <div className="divide-border divide-y">
                {teams.map((team) => {
                  const managerName = team.manager?.name ?? 'Unknown Manager';
                  const managerEmail = team.manager?.email ?? '';
                  const isManagerSelf = team.manager_id === currentUserId;

                  return (
                    <div
                      key={team.id}
                      className="group flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="bg-primary/10 text-primary border-primary/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold shadow-sm transition-all duration-300 group-hover:scale-105">
                          {team.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-foreground group-hover:text-primary flex items-center gap-2 text-sm leading-none font-semibold transition-colors">
                            <span className="truncate">{team.name}</span>
                            {team.status === 'archived' && (
                              <span className="py-0.2 shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] font-semibold tracking-normal text-amber-600 uppercase">
                                Archived
                              </span>
                            )}
                            {team.status === 'inactive' && (
                              <span className="py-0.2 shrink-0 rounded-full border border-slate-500/20 bg-slate-500/10 px-1.5 text-[10px] font-semibold tracking-normal text-slate-600 uppercase">
                                Inactive
                              </span>
                            )}
                          </h4>
                          {team.description && (
                            <p className="text-muted-foreground mt-1 truncate text-xs">
                              {team.description}
                            </p>
                          )}
                          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span className="flex min-w-0 items-center gap-1">
                              <Shield className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                Manager:{' '}
                                <strong className="text-foreground">
                                  {managerName}
                                </strong>
                                {managerEmail && ` (${managerEmail})`}
                              </span>
                              {isManagerSelf && (
                                <span className="bg-primary/25 border-primary/30 text-primary py-0.2 ml-1.5 shrink-0 rounded-full border px-1.5 text-[9px] font-semibold tracking-normal uppercase">
                                  You
                                </span>
                              )}
                            </span>
                            {team.tech_stack && (
                              <span className="flex min-w-0 items-center gap-1">
                                <Terminal className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  Stack:{' '}
                                  <strong className="text-foreground">
                                    {team.tech_stack}
                                  </strong>
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pl-13 sm:grid sm:shrink-0 sm:grid-cols-[100px_100px] sm:items-center sm:gap-4 sm:pl-0">
                        <div className="flex w-full justify-start">
                          {team.status !== 'archived'
                            ? isManagerOrAdmin && (
                                <button
                                  disabled={isPending}
                                  onClick={() => setTeamToEdit(team)}
                                  className="focus-visible:ring-ring inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[11px] text-emerald-600 font-semibold shadow-sm transition-all hover:bg-emerald-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  Edit
                                </button>
                              )
                            : isManagerOrAdmin && (
                                <Button
                                  disabled={isPending}
                                  onClick={() => handleRestore(team)}
                                  className="h-8 w-full border-emerald-500/20 bg-emerald-500/10 text-[11px] text-emerald-600 shadow-sm transition-all hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                                >
                                  <RefreshCw className="mr-1 h-3 w-3 shrink-0" />
                                  Restore
                                </Button>
                              )}
                        </div>

                        <div className="flex w-full justify-start">
                          {team.status !== 'archived'
                            ? isManagerOrAdmin && (
                                <button
                                  disabled={isPending}
                                  onClick={() => handleSoftDelete(team)}
                                  className="focus-visible:ring-ring inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-[11px] text-rose-600 shadow-sm transition-all hover:bg-rose-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                                >
                                  <Archive className="mr-1 h-3 w-3" />
                                  Archive
                                </button>
                              )
                            : isAdmin && (
                                <button
                                  disabled={isPending}
                                  onClick={() => handleHardDelete(team)}
                                  className="focus-visible:ring-ring border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border text-[11px] shadow-sm transition-all hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                                >
                                  <Trash2 className="mr-1 h-3 w-3 shrink-0" />
                                  Purge
                                </button>
                              )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <Pagination
                totalCount={totalCount}
                page={page}
                limit={limit}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                label="teams"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals / Forms */}
      {isAddTeamOpen && (
        <div className="bg-background/80 animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm duration-300">
          <div className="w-full max-w-lg">
            <TeamForm
              users={users}
              onClose={() => setIsAddTeamOpen(false)}
              onSuccess={() => {
                setIsAddTeamOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      {teamToEdit && (
        <div className="bg-background/80 animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm duration-300">
          <div className="w-full max-w-lg">
            <TeamForm
              users={users}
              teamToEdit={teamToEdit}
              onClose={() => setTeamToEdit(null)}
              onSuccess={() => {
                setTeamToEdit(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation dialog */}
      {teamToDelete && (
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
                  {deleteMode === 'soft'
                    ? 'Archive Team'
                    : 'Permanently Delete Team'}
                </h3>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
                Are you sure you want to
                {deleteMode === 'soft' ? ' archive ' : ' permanently delete '}
                <strong className="text-foreground">
                  {teamToDelete.name}
                </strong>
                {' ?'}
              </p>
              <p className="text-muted-foreground/80 bg-muted/50 border-border/40 mt-2 rounded-lg border p-2.5 text-xs">
                {deleteMode === 'soft'
                  ? 'It will be hidden from the active teams list, but can be restored later from the Archived tab.'
                  : 'Warning: This action is irreversible. This will permanently purge the record from the database.'}
              </p>
            </div>

            <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setTeamToDelete(null)}
                className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md border px-4 text-xs font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmDelete}
                className="focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {deleteButtonText}
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
