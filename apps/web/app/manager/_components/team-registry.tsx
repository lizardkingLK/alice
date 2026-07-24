'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
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
import { TeamForm } from './team-form';
import { softDeleteTeam, restoreTeam, hardDeleteTeam } from './actions';
import { Users, Shield, Plus, Search, FolderOpen } from '@repo/ui/lib/icons';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import {
  RegistryRowActions,
  registryActionsHeader,
} from '@/components/registry-row-actions';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import type { Team } from '../_services/teams.service';
import type { User } from '@/app/users/_services/users.service';
import type { Project } from '@/app/projects/_services/projects.service.base';

type TeamTab = 'active' | 'inactive' | 'archived';

const TEAM_TABS = [
  { id: 'active' as const, label: 'Active' },
  { id: 'inactive' as const, label: 'Inactive' },
  { id: 'archived' as const, label: 'Archived' },
];

interface TeamRegistryProps {
  readonly teams: Team[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly tab: TeamTab;
  readonly search: string;
  readonly users: User[];
  readonly activeProjects: Project[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

/* eslint-disable no-unused-vars */
interface TeamTableMeta {
  readonly currentUserId?: string | null;
  readonly isPending: boolean;
  readonly isManagerOrAdmin: boolean;
  readonly isAdmin: boolean;
  readonly onEdit: (team: Team) => void;
  readonly onRestore: (team: Team) => void;
  readonly onSoftDelete: (team: Team) => void;
  readonly onHardDelete: (team: Team) => void;
}

type TeamCellRenderer = (context: CellContext<Team, unknown>) => ReactNode;
/* eslint-enable no-unused-vars */

function getTeamTableMeta(table: CellContext<Team, unknown>['table']) {
  return table.options.meta as TeamTableMeta;
}

function TeamNameCell({ team }: Readonly<{ team: Team }>) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 text-primary border-primary/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold shadow-sm transition-all duration-300 group-hover:scale-105">
        {team.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-foreground flex items-center gap-2 text-sm font-semibold transition-colors">
          <span className="truncate">{team.name}</span>
          {team.status === 'archived' ? (
            <span className="py-0.2 shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 text-[9px] font-semibold tracking-normal text-amber-600 uppercase">
              Archived
            </span>
          ) : null}
          {team.status === 'inactive' ? (
            <span className="py-0.2 shrink-0 rounded-full border border-slate-500/20 bg-slate-500/10 px-1.5 text-[9px] font-semibold tracking-normal text-slate-600 uppercase">
              Inactive
            </span>
          ) : null}
        </div>
        {team.description ? (
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            {team.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TeamManagerCell({
  team,
  currentUserId,
}: Readonly<{ team: Team; currentUserId?: string | null }>) {
  const managerName = team.manager?.name ?? 'Unknown Manager';
  const managerEmail = team.manager?.email ?? '';
  const isManagerSelf = team.manager_id === currentUserId;

  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      <Shield className="h-3 w-3 shrink-0" />
      <span className="truncate">
        <strong className="text-foreground font-semibold">{managerName}</strong>
        {managerEmail ? ` (${managerEmail})` : null}
      </span>
      {isManagerSelf ? (
        <span className="bg-primary/25 border-primary/30 text-primary py-0.2 ml-1.5 shrink-0 rounded-full border px-1.5 text-[9px] font-semibold tracking-normal uppercase">
          You
        </span>
      ) : null}
    </span>
  );
}

const CELL_RENDERERS: Record<string, TeamCellRenderer> = {
  team: ({ row }) => <TeamNameCell team={row.original} />,
  manager: ({ row, table }) => (
    <TeamManagerCell
      team={row.original}
      currentUserId={getTeamTableMeta(table).currentUserId}
    />
  ),
  actions: ({ row, table }) => {
    const meta = getTeamTableMeta(table);
    const team = row.original;
    return (
      <RegistryRowActions
        isPending={meta.isPending}
        isManagerOrAdmin={meta.isManagerOrAdmin}
        isAdmin={meta.isAdmin}
        isActiveView={team.status !== 'archived'}
        onEdit={() => meta.onEdit(team)}
        onRestore={() => meta.onRestore(team)}
        onArchive={() => meta.onSoftDelete(team)}
        onPurge={() => meta.onHardDelete(team)}
      />
    );
  },
};

const TEAM_COLUMNS: ColumnDef<Team>[] = [
  { id: 'team', header: 'Team', cell: CELL_RENDERERS.team },
  { id: 'manager', header: 'Manager', cell: CELL_RENDERERS.manager },
  {
    id: 'actions',
    header: registryActionsHeader,
    cell: CELL_RENDERERS.actions,
  },
];

function getTeamRegistryDescription(tab: TeamTab) {
  if (tab === 'active') {
    return 'View and manage active software engineering teams.';
  }
  if (tab === 'inactive') {
    return 'View and manage temporarily suspended or inactive teams.';
  }
  return 'Restore archived teams, or permanently delete them from the database.';
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
  activeProjects,
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
  const isSoftDelete = deleteMode === 'soft';

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
      nextQueryParams.set('page', '1');
      router.push(`${pathname}?${nextQueryParams.toString()}`);
    }, 450);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, pathname, router, searchParams]);

  const changeTabSelection = (tabKey: TeamTab) => {
    const nextQueryParams = new URLSearchParams(searchParams);
    nextQueryParams.set('tab', tabKey);
    nextQueryParams.set('page', '1');
    router.push(`${pathname}?${nextQueryParams.toString()}`);
  };

  const handleSoftDelete = useCallback((item: Team) => {
    setTeamToDelete(item);
    setDeleteMode('soft');
    setError(null);
  }, []);

  const handleHardDelete = useCallback((item: Team) => {
    setTeamToDelete(item);
    setDeleteMode('hard');
    setError(null);
  }, []);

  const confirmDelete = () => {
    if (teamToDelete === null) return;

    startTransition(async () => {
      const actionResult = isSoftDelete
        ? await softDeleteTeam(teamToDelete.id)
        : await hardDeleteTeam(teamToDelete.id);

      if (!actionResult.success) {
        setError(
          actionResult.error ?? `Operation failed during ${deleteMode} delete.`
        );
        return;
      }

      setTeamToDelete(null);
      setError(null);
      router.refresh();
    });
  };

  const handleRestore = useCallback(
    (item: Team) => {
      setError(null);
      startTransition(async () => {
        const actionResult = await restoreTeam(item.id);
        if (actionResult.success) {
          router.refresh();
        } else {
          setError(actionResult.error ?? 'Unable to restore team.');
        }
      });
    },
    [router]
  );

  const openEdit = useCallback((team: Team) => {
    setTeamToEdit(team);
  }, []);

  const columns = useMemo(() => TEAM_COLUMNS, []);

  const table = useReactTable({
    data: teams,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      currentUserId,
      isPending,
      isManagerOrAdmin,
      isAdmin,
      onEdit: openEdit,
      onRestore: handleRestore,
      onSoftDelete: handleSoftDelete,
      onHardDelete: handleHardDelete,
    } satisfies TeamTableMeta,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

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
          <RegistryTabSwitcher
            tabs={TEAM_TABS}
            value={tab}
            onChange={changeTabSelection}
          />

          {isManagerOrAdmin ? (
            <Button
              onClick={() => {
                setTeamToEdit(null);
                setIsAddTeamOpen(true);
              }}
              className="flex h-10 w-32 shrink-0 cursor-pointer items-center justify-center px-6 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
            >
              <Plus className="mr-1.5 h-4 w-4 shrink-0" />
              Add Team
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="text-primary h-5 w-5" />
            Teams Registry
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {getTeamRegistryDescription(tab)}
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
                <p>No teams found matching the criteria.</p>
              </div>
            }
          />

          <Pagination
            totalCount={totalCount}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            label="teams"
          />
        </CardContent>
      </Card>

      {isAddTeamOpen ? (
        <div className="bg-background/80 animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm duration-300">
          <div className="w-full max-w-xl">
            <TeamForm
              users={users}
              activeProjects={activeProjects}
              onClose={() => setIsAddTeamOpen(false)}
              onSuccess={() => {
                setIsAddTeamOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}

      {teamToEdit ? (
        <div className="bg-background/80 animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm duration-300">
          <div className="w-full max-w-xl">
            <TeamForm
              users={users}
              activeProjects={activeProjects}
              teamToEdit={teamToEdit}
              onClose={() => setTeamToEdit(null)}
              onSuccess={() => {
                setTeamToEdit(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}

      {teamToDelete ? (
        <RegistryConfirmDialog
          title={isSoftDelete ? 'Archive Team' : 'Permanently Delete Team'}
          subject={teamToDelete.name}
          detail={
            isSoftDelete
              ? 'It will be hidden from the active teams list, but can be restored later from the Archived tab.'
              : 'Warning: This action is irreversible. This will permanently purge the record from the database.'
          }
          confirmLabel={isSoftDelete ? 'Archive Team' : 'Delete Permanently'}
          isPending={isPending}
          isSoft={isSoftDelete}
          onCancel={() => setTeamToDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
