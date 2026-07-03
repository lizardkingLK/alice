'use client';

import { useState, useTransition, ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
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
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Plus,
  Search,
  FolderOpen,
} from 'lucide-react';
import type { Tables } from '@repo/types';

type DbUser = Tables<'users'>;
type DbProject = Tables<'projects'> & {
  owner?: Pick<DbUser, 'id' | 'name' | 'email'> | null;
};

interface ProjectRegistryProps {
  readonly projects: DbProject[];
  readonly users: DbUser[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

export function ProjectRegistry({
  projects,
  users,
  currentUserId,
  currentUserRole,
}: Readonly<ProjectRegistryProps>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<DbProject | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<DbProject | null>(
    null
  );
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';
  const isAdmin = currentUserRole === 'admin';

  // Filter projects based on search query and soft-delete status
  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const isSoftDeleted = !!proj.deleted_at;

    if (filterTab === 'active') {
      return matchesSearch && !isSoftDeleted;
    } else {
      return matchesSearch && isSoftDeleted;
    }
  });

  const handleSoftDelete = (proj: DbProject) => {
    setProjectToDelete(proj);
    setDeleteMode('soft');
    setError(null);
  };

  const handleHardDelete = (proj: DbProject) => {
    setProjectToDelete(proj);
    setDeleteMode('hard');
    setError(null);
  };

  const confirmDelete = () => {
    if (!projectToDelete) return;

    startTransition(async () => {
      let result;
      if (deleteMode === 'soft') {
        result = await softDeleteProject(projectToDelete.id);
      } else {
        result = await hardDeleteProject(projectToDelete.id);
      }

      if (result.success) {
        setProjectToDelete(null);
        setError(null);
      } else {
        setError(result.error || `Failed to ${deleteMode} delete project.`);
      }
    });
  };

  const handleRestore = (proj: DbProject) => {
    setError(null);
    startTransition(async () => {
      const result = await restoreProject(proj.id);
      if (!result.success) {
        setError(result.error || 'Failed to restore project.');
      }
    });
  };

  let deleteButtonText: ReactNode;
  if (isPending) {
    deleteButtonText = (
      <>
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        Deleting...
      </>
    );
  } else if (deleteMode === 'soft') {
    deleteButtonText = 'Archive Project';
  } else {
    deleteButtonText = 'Delete Permanently';
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-destructive bg-destructive/10 border-destructive/20 relative flex items-center gap-2 rounded-lg border p-3 text-sm">
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

      {/* Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name, key, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-input bg-background/50 placeholder:text-muted-foreground focus-visible:ring-primary flex h-10 w-full rounded-md border py-2 pr-4 pl-10 text-sm transition-all focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
            <button
              onClick={() => setFilterTab('active')}
              className={`ring-offset-background inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                filterTab === 'active'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterTab('archived')}
              className={`ring-offset-background inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                filterTab === 'archived'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              Archived
            </button>
          </div>

          {isManagerOrAdmin && (
            <button
              onClick={() => {
                setProjectToEdit(null);
                setIsAddProjectOpen(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/95 inline-flex h-10 cursor-pointer items-center justify-center rounded-md px-4 text-xs font-semibold shadow-md transition-all duration-300 hover:shadow-lg"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Project
            </button>
          )}
        </div>
      </div>

      {/* Projects list */}
      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Folder className="text-primary h-5 w-5" />
            Projects Registry
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {filterTab === 'active'
              ? 'View and manage active software project workspaces.'
              : 'Restore soft-deleted projects, or permanently delete them from the database.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
              <FolderOpen className="text-muted-foreground/50 h-8 w-8 animate-bounce stroke-1" />
              <p>No projects found matching the criteria.</p>
            </div>
          ) : (
            <div className="divide-border divide-y">
              {filteredProjects.map((proj) => {
                const ownerName = proj.owner?.name ?? 'Unknown Owner';
                const ownerEmail = proj.owner?.email ?? '';
                const isOwnerSelf = proj.owner_id === currentUserId;

                return (
                  <div
                    key={proj.id}
                    className="group flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 text-primary border-primary/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold shadow-sm transition-all duration-300 group-hover:scale-105">
                        {proj.key.slice(0, 2)}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-foreground group-hover:text-primary flex items-center gap-2 text-sm leading-none font-semibold transition-colors">
                          {proj.name}
                          {proj.status === 'archived' && (
                            <span className="py-0.2 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] font-semibold tracking-normal text-amber-600 uppercase">
                              Archived
                            </span>
                          )}
                        </h4>
                        {proj.description && (
                          <p className="text-muted-foreground line-clamp-1 text-xs">
                            {proj.description}
                          </p>
                        )}
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Shield className="h-3 w-3" />
                          <span>
                            Owner:{' '}
                            <strong className="text-foreground">
                              {ownerName}
                            </strong>
                            {ownerEmail && ` (${ownerEmail})`}
                            {isOwnerSelf && (
                              <span className="bg-primary/25 border-primary/30 text-primary py-0.2 ml-1.5 rounded-full border px-1.5 text-[9px] font-semibold tracking-normal uppercase">
                                You
                              </span>
                            )}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pl-13 sm:gap-4 sm:pl-0">
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {proj.start_date || proj.end_date ? (
                            <>
                              {proj.start_date
                                ? new Date(proj.start_date).toLocaleDateString(
                                    undefined,
                                    { month: 'short', year: 'numeric' }
                                  )
                                : 'Start'}
                              {' — '}
                              {proj.end_date
                                ? new Date(proj.end_date).toLocaleDateString(
                                    undefined,
                                    { month: 'short', year: 'numeric' }
                                  )
                                : 'End'}
                            </>
                          ) : (
                            'No timeline configured'
                          )}
                        </span>
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {filterTab === 'active' ? (
                          <>
                            {isManagerOrAdmin && (
                              <button
                                onClick={() => {
                                  setProjectToEdit(proj);
                                }}
                                className="border-input hover:bg-accent text-foreground focus-visible:ring-ring flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-semibold shadow-sm transition-all focus-visible:ring-2 focus-visible:outline-none"
                              >
                                Edit
                              </button>
                            )}
                            {isManagerOrAdmin && (
                              <button
                                disabled={isPending}
                                onClick={() => handleSoftDelete(proj)}
                                className="focus-visible:ring-ring flex h-8 cursor-pointer items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {isManagerOrAdmin && (
                              <button
                                disabled={isPending}
                                onClick={() => handleRestore(proj)}
                                className="focus-visible:ring-ring flex h-8 cursor-pointer items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600 shadow-sm transition-all hover:bg-emerald-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                              >
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Restore
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                disabled={isPending}
                                onClick={() => handleHardDelete(proj)}
                                className="focus-visible:ring-ring flex h-9 cursor-pointer items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-600 hover:text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Purge
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {isAddProjectOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <ProjectForm
              users={users}
              onClose={() => setIsAddProjectOpen(false)}
              onSuccess={() => setIsAddProjectOpen(false)}
            />
          </div>
        </div>
      )}

      {projectToEdit && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <ProjectForm
              users={users}
              projectToEdit={projectToEdit}
              onClose={() => setProjectToEdit(null)}
              onSuccess={() => setProjectToEdit(null)}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
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
                    ? 'Archive Project'
                    : 'Permanently Delete Project'}
                </h3>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
                Are you sure you want to
                {deleteMode === 'soft' ? ' archive ' : ' permanently delete '}
                <strong className="text-foreground">
                  {projectToDelete.name} ({projectToDelete.key})
                </strong>
                {' ?'}
              </p>
              <p className="text-muted-foreground/80 bg-muted/50 border-border/40 mt-2 rounded-lg border p-2.5 text-xs">
                {deleteMode === 'soft'
                  ? 'It will be hidden from the active projects list, but can be restored later from the Archived tab.'
                  : 'Warning: This action is irreversible. All issues, sprints, and comments associated with this project will be permanently destroyed.'}
              </p>
            </div>

            <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setProjectToDelete(null)}
                className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md border px-4 text-xs font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmDelete}
                className="focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:ring-2 focus-visible:outline-none"
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
