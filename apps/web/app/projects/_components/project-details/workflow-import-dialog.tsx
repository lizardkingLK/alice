'use client';

import { useEffect, useState, type Dispatch } from 'react';
import { ProjectStatusEnum } from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { AlertCircle } from '@repo/ui/lib/icons';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';
import { afterDialogClose } from '@/lib/dialog-close';
import type { GetProjectsPaginatedResponse } from '@/app/projects/_types/projects.types';
import {
  getProjectWorkflowConfig,
  type ProjectWorkflowConfigResponse,
} from '@/app/projects/_services/projects.workflow-config.client';

export type WorkflowImportSubmitInput = {
  readonly sourceProjectId: string;
  readonly sourceWorkflowId: string;
  readonly title: string;
  readonly markAsDefault: boolean;
};

type WorkflowImportDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: Dispatch<boolean>;
  readonly currentProjectId: string;
  readonly busy?: boolean;
  /* eslint-disable-next-line no-unused-vars -- callback docs */
  readonly onImport: (input: WorkflowImportSubmitInput) => void;
};

type SourceProjectOption = {
  readonly id: string;
  readonly name: string;
  readonly key: string;
};

type CachedWorkflowList = {
  readonly defaultWorkflowId: string;
  readonly workflows: readonly {
    readonly id: string;
    readonly title: string;
  }[];
};

function toCachedWorkflowList(
  response: ProjectWorkflowConfigResponse
): CachedWorkflowList {
  return {
    defaultWorkflowId: response.config.defaultWorkflowId,
    workflows: response.config.workflows.map((workflow) => ({
      id: workflow.id,
      title: workflow.title,
    })),
  };
}

function defaultImportTitle(sourceTitle: string): string {
  return `${sourceTitle} (import)`;
}

function titleFromCachedDefault(cached: CachedWorkflowList): string {
  const defaultWorkflow = cached.workflows.find(
    (workflow) => workflow.id === cached.defaultWorkflowId
  );
  return defaultImportTitle(defaultWorkflow?.title ?? 'Workflow');
}

function projectSelectPlaceholder(
  loading: boolean,
  projectCount: number
): string {
  if (loading) {
    return 'Loading projects…';
  }
  if (projectCount === 0) {
    return 'No other active projects';
  }
  return 'Select a project';
}

function workflowSelectPlaceholder(
  hasProject: boolean,
  loading: boolean
): string {
  if (!hasProject) {
    return 'Select a project first';
  }
  if (loading) {
    return 'Loading workflows…';
  }
  return 'Select a workflow';
}

export function WorkflowImportDialog({
  open,
  onOpenChange,
  currentProjectId,
  busy = false,
  onImport,
}: Readonly<WorkflowImportDialogProps>) {
  const [projects, setProjects] = useState<readonly SourceProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [workflowCache, setWorkflowCache] = useState<
    Readonly<Record<string, CachedWorkflowList>>
  >({});
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);
  const [sourceProjectId, setSourceProjectId] = useState('');
  const [sourceWorkflowId, setSourceWorkflowId] = useState('');
  const [title, setTitle] = useState('');
  const [markAsDefault, setMarkAsDefault] = useState(false);

  const cachedSource = sourceProjectId
    ? workflowCache[sourceProjectId]
    : undefined;
  const sourceWorkflows = cachedSource?.workflows ?? [];
  const hasSelectedWorkflow = sourceWorkflows.some(
    (workflow) => workflow.id === sourceWorkflowId
  );
  const canSubmit =
    Boolean(sourceProjectId) &&
    Boolean(sourceWorkflowId) &&
    title.trim().length > 0 &&
    !busy &&
    !workflowsLoading;

  useEffect(() => {
    if (!open) {
      return afterDialogClose(() => {
        setProjects([]);
        setProjectsLoading(false);
        setProjectsError(null);
        setWorkflowCache({});
        setWorkflowsLoading(false);
        setWorkflowsError(null);
        setSourceProjectId('');
        setSourceWorkflowId('');
        setTitle('');
        setMarkAsDefault(false);
      });
    }

    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);

    apiFetch<GetProjectsPaginatedResponse>(
      `/api/projects?page=1&limit=100&status=${ProjectStatusEnum.active}`
    )
      .then((response) => {
        if (cancelled) {
          return;
        }
        setProjects(
          response.projects
            .filter((project) => project.id !== currentProjectId)
            .map((project) => ({
              id: project.id,
              name: project.name,
              key: project.key,
            }))
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setProjectsError('Could not load active projects.');
        setProjects([]);
      })
      .finally(() => {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentProjectId, open]);

  useEffect(() => {
    if (!open || !sourceProjectId) {
      return;
    }

    if (workflowCache[sourceProjectId]) {
      return;
    }

    let cancelled = false;
    setWorkflowsLoading(true);
    setWorkflowsError(null);

    getProjectWorkflowConfig(sourceProjectId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const cached = toCachedWorkflowList(response);
        setWorkflowCache((previous) => ({
          ...previous,
          [sourceProjectId]: cached,
        }));
        setSourceWorkflowId(cached.defaultWorkflowId);
        setTitle(titleFromCachedDefault(cached));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setWorkflowsError('Could not load workflows for that project.');
      })
      .finally(() => {
        if (!cancelled) {
          setWorkflowsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, sourceProjectId, workflowCache]);

  const handleProjectChange = (nextProjectId: string) => {
    setSourceProjectId(nextProjectId);
    setWorkflowsError(null);

    const cached = workflowCache[nextProjectId];
    if (!cached) {
      setSourceWorkflowId('');
      setTitle('');
      return;
    }

    setSourceWorkflowId(cached.defaultWorkflowId);
    setTitle(titleFromCachedDefault(cached));
  };

  const handleWorkflowChange = (nextWorkflowId: string) => {
    setSourceWorkflowId(nextWorkflowId);
    const workflow = sourceWorkflows.find(
      (entry) => entry.id === nextWorkflowId
    );
    if (workflow) {
      setTitle(defaultImportTitle(workflow.title));
    }
  };

  const handleImport = () => {
    if (!canSubmit) {
      return;
    }
    onImport({
      sourceProjectId,
      sourceWorkflowId,
      title: title.trim(),
      markAsDefault,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="workflow-import-dialog"
      >
        <DialogHeader>
          <DialogTitle>Import workflow</DialogTitle>
          <DialogDescription>
            Copy a workflow from another active project into this one as a new
            workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="workflow-import-source-project">
              Source project
            </Label>
            <Select
              value={sourceProjectId}
              onValueChange={handleProjectChange}
              disabled={projectsLoading || busy || projects.length === 0}
            >
              <SelectTrigger
                id="workflow-import-source-project"
                data-testid="workflow-import-source-project"
              >
                <SelectValue
                  placeholder={projectSelectPlaceholder(
                    projectsLoading,
                    projects.length
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} ({project.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectsError ? (
              <p className="text-destructive text-sm">{projectsError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workflow-import-source-workflow">
              Source workflow
            </Label>
            <Select
              value={sourceWorkflowId}
              onValueChange={handleWorkflowChange}
              disabled={
                !sourceProjectId ||
                workflowsLoading ||
                busy ||
                sourceWorkflows.length === 0
              }
            >
              <SelectTrigger
                id="workflow-import-source-workflow"
                data-testid="workflow-import-source-workflow"
              >
                <SelectValue
                  placeholder={workflowSelectPlaceholder(
                    Boolean(sourceProjectId),
                    workflowsLoading
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {sourceWorkflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workflowsError ? (
              <p className="text-destructive text-sm">{workflowsError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workflow-import-title">New workflow title</Label>
            <Input
              id="workflow-import-title"
              data-testid="workflow-import-title"
              value={title}
              disabled={busy || !sourceWorkflowId}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              maxLength={120}
            />
          </div>

          {hasSelectedWorkflow ? (
            <output
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950"
              data-testid="workflow-import-auth-notice"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Transition move restrictions will be dropped on import.
                Configure who can move items on each edge afterward in Settings.
              </span>
            </output>
          ) : null}

          <div className="flex items-start gap-2">
            <Checkbox
              id="workflow-import-mark-default"
              data-testid="workflow-import-mark-default"
              checked={markAsDefault}
              disabled={busy || !sourceWorkflowId}
              onCheckedChange={(value) => {
                setMarkAsDefault(value === true);
              }}
              className="mt-0.5"
            />
            <Label
              htmlFor="workflow-import-mark-default"
              className="leading-snug font-normal"
            >
              Mark as default after import
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            data-testid="workflow-import-submit"
            onClick={handleImport}
          >
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
