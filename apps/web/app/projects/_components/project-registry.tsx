'use client';

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { ProjectForm } from './project-form';
import {
  softDeleteProject,
  restoreProject,
  hardDeleteProject,
} from './actions';
import {
  Folder,
  Calendar,
  Shield,
  Plus,
  Search,
  FolderOpen,
} from '@repo/ui/lib/icons';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { DismissibleError } from '@/components/dismissible-error';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import {
  RegistryRowActions,
  registryActionsHeader,
} from '@/components/registry-row-actions';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import type { Project } from '../_services/projects.service';
import type { User } from '@/app/users/_services/users.service';

type ProjectTab = 'active' | 'archived';

const PROJECT_TABS = [
  { id: 'active' as const, label: 'Active' },
  { id: 'archived' as const, label: 'Archived' },
];

interface ProjectRegistryProps {
  readonly projects: Project[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly tab: ProjectTab;
  readonly search: string;
  readonly users: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

function formatTimeline(startDate?: string | null, endDate?: string | null) {
  if (!startDate && !endDate) return 'No timeline';
  const startStr = startDate
    ? new Date(startDate).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : 'Start';
  const endStr = endDate
    ? new Date(endDate).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : 'End';
  return `${startStr} - ${endStr}`;
}

/* eslint-disable no-unused-vars */
interface ProjectTableMeta {
  readonly currentUserId?: string | null;
  readonly isPending: boolean;
  readonly tab: ProjectTab;
  readonly isManagerOrAdmin: boolean;
  readonly isAdmin: boolean;
  readonly onEdit: (proj: Project) => void;
  readonly onRestore: (proj: Project) => void;
  readonly onSoftDelete: (proj: Project) => void;
  readonly onHardDelete: (proj: Project) => void;
}

type ProjectCellRenderer = (
  context: CellContext<Project, unknown>
) => ReactNode;
/* eslint-enable no-unused-vars */

function getProjectTableMeta(table: CellContext<Project, unknown>['table']) {
  return table.options.meta as ProjectTableMeta;
}

function ProjectNameCell({ proj }: Readonly<{ proj: Project }>) {
  return (
    <Link
      href={`/projects/${proj.id}`}
      className="group/row flex items-center gap-3 transition-opacity hover:opacity-85"
    >
      <div className="bg-primary/10 text-primary border-primary/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold shadow-sm transition-all duration-300 group-hover/row:scale-105">
        {proj.key.slice(0, 2)}
      </div>
      <div className="min-w-0">
        <div className="text-foreground group-hover/row:text-primary flex items-center gap-2 text-sm font-semibold transition-colors">
          <span className="truncate">{proj.name}</span>
          {proj.status === 'archived' ? (
            <span className="py-0.2 shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 text-[9px] font-semibold tracking-normal text-amber-600 uppercase">
              Archived
            </span>
          ) : null}
        </div>
        {proj.description ? (
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            {proj.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function ProjectOwnerCell({
  proj,
  currentUserId,
}: Readonly<{ proj: Project; currentUserId?: string | null }>) {
  const ownerName = proj.owner?.name ?? 'Unknown Owner';
  const ownerEmail = proj.owner?.email ?? '';
  const isOwnerSelf = proj.owner_id === currentUserId;

  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      <Shield className="h-3 w-3 shrink-0" />
      <span className="truncate">
        <strong className="text-foreground font-semibold">{ownerName}</strong>
        {ownerEmail ? ` (${ownerEmail})` : null}
      </span>
      {isOwnerSelf ? (
        <span className="bg-primary/25 border-primary/30 text-primary py-0.2 ml-1.5 shrink-0 rounded-full border px-1.5 text-[9px] font-semibold tracking-normal uppercase">
          You
        </span>
      ) : null}
    </span>
  );
}

const CELL_RENDERERS: Record<string, ProjectCellRenderer> = {
  project: ({ row }) => <ProjectNameCell proj={row.original} />,
  owner: ({ row, table }) => (
    <ProjectOwnerCell
      proj={row.original}
      currentUserId={getProjectTableMeta(table).currentUserId}
    />
  ),
  timeline: ({ row }) => (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      <Calendar className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {formatTimeline(row.original.start_date, row.original.end_date)}
      </span>
    </span>
  ),
  actions: ({ row, table }) => {
    const meta = getProjectTableMeta(table);
    const proj = row.original;
    return (
      <RegistryRowActions
        isPending={meta.isPending}
        isManagerOrAdmin={meta.isManagerOrAdmin}
        isAdmin={meta.isAdmin}
        isActiveView={meta.tab === 'active'}
        onEdit={() => meta.onEdit(proj)}
        onRestore={() => meta.onRestore(proj)}
        onArchive={() => meta.onSoftDelete(proj)}
        onPurge={() => meta.onHardDelete(proj)}
      />
    );
  },
};

const PROJECT_COLUMNS: ColumnDef<Project>[] = [
  { id: 'project', header: 'Project', cell: CELL_RENDERERS.project },
  { id: 'owner', header: 'Owner', cell: CELL_RENDERERS.owner },
  { id: 'timeline', header: 'Timeline', cell: CELL_RENDERERS.timeline },
  {
    id: 'actions',
    header: registryActionsHeader,
    cell: CELL_RENDERERS.actions,
  },
];

export function ProjectRegistry({
  projects,
  totalCount,
  page,
  limit,
  totalPages,
  tab,
  search,
  users,
  currentUserId,
  currentUserRole,
}: Readonly<ProjectRegistryProps>) {
  const {
    handlePageChange,
    handleLimitChange,
    pathname,
    router,
    searchParams,
  } = usePaginationNavigation(totalPages, limit);

  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';
  const isAdmin = currentUserRole === 'admin';
  const isSoftDelete = deleteMode === 'soft';

  const handleTabChange = (newTab: ProjectTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSoftDelete = useCallback((proj: Project) => {
    setProjectToDelete(proj);
    setDeleteMode('soft');
    setError(null);
  }, []);

  const handleHardDelete = useCallback((proj: Project) => {
    setProjectToDelete(proj);
    setDeleteMode('hard');
    setError(null);
  }, []);

  const handleRestore = useCallback(
    (proj: Project) => {
      setError(null);
      startTransition(async () => {
        const result = await restoreProject(proj.id);
        if (result.success) {
          router.refresh();
        } else {
          setError(result.error || 'Failed to restore project.');
        }
      });
    },
    [router]
  );

  const openEdit = useCallback((proj: Project) => {
    setProjectToEdit(proj);
  }, []);

  const confirmDelete = () => {
    if (!projectToDelete) return;

    startTransition(async () => {
      const result = isSoftDelete
        ? await softDeleteProject(projectToDelete.id)
        : await hardDeleteProject(projectToDelete.id);

      if (!result.success) {
        setError(result.error || `Failed to ${deleteMode} delete project.`);
        return;
      }

      setProjectToDelete(null);
      setError(null);
      router.refresh();
    });
  };

  const columns = useMemo(() => PROJECT_COLUMNS, []);

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      currentUserId,
      isPending,
      tab,
      isManagerOrAdmin,
      isAdmin,
      onEdit: openEdit,
      onRestore: handleRestore,
      onSoftDelete: handleSoftDelete,
      onHardDelete: handleHardDelete,
    } satisfies ProjectTableMeta,
  });

  return (
    <div className="space-y-6">
      <DismissibleError message={error} onDismiss={() => setError(null)} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search projects by name, key, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background/50 h-10 py-2 pr-4 pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <RegistryTabSwitcher
            tabs={PROJECT_TABS}
            value={tab}
            onChange={handleTabChange}
          />

          {isManagerOrAdmin ? (
            <Button
              onClick={() => {
                setProjectToEdit(null);
                setIsAddProjectOpen(true);
              }}
              className="flex h-10 w-32 shrink-0 items-center justify-center px-6 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
            >
              <Plus className="mr-1.5 h-4 w-4 shrink-0" />
              Add Project
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Folder className="text-primary h-5 w-5" />
            Projects Registry
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {tab === 'active'
              ? 'View and manage active software project workspaces.'
              : 'Restore soft-deleted projects, or permanently delete them from the database.'}
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
                <p>No projects found matching the criteria.</p>
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
            label="projects"
          />
        </CardContent>
      </Card>

      {isAddProjectOpen ? (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <ProjectForm
              users={users}
              onClose={() => setIsAddProjectOpen(false)}
              onSuccess={() => {
                setIsAddProjectOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}

      {projectToEdit ? (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <ProjectForm
              users={users}
              projectToEdit={projectToEdit}
              onClose={() => setProjectToEdit(null)}
              onSuccess={() => {
                setProjectToEdit(null);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}

      {projectToDelete ? (
        <RegistryConfirmDialog
          title={
            isSoftDelete ? 'Archive Project' : 'Permanently Delete Project'
          }
          subject={`${projectToDelete.name} (${projectToDelete.key})`}
          detail={
            isSoftDelete
              ? 'It will be hidden from the active projects list, but can be restored later from the Archived tab.'
              : 'Warning: This action is irreversible. All issues, sprints, and comments associated with this project will be permanently destroyed.'
          }
          confirmLabel={isSoftDelete ? 'Archive Project' : 'Delete Permanently'}
          pendingLabel="Deleting..."
          isPending={isPending}
          isSoft={isSoftDelete}
          onCancel={() => setProjectToDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
