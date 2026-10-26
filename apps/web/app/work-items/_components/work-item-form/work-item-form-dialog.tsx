'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Loader2 } from '@repo/ui/lib/icons';
import {
  WorkItemForm,
  type WorkItemFormProps,
} from '@/app/work-items/_components/work-item-form/work-item-form';
import { useWorkItemCreateFormMode } from '@/app/work-items/_hooks/use-work-item-create-form-mode';
import type { WorkItemSprintOption } from '@/app/work-items/_helpers/work-item-sprint';
import { getWorkItemById } from '@/app/work-items/_services/work-items.reads.client';
import type { DbWorkItem } from '@/app/work-items/_types/work-items.reads.types';
import {
  fetchProjectMembersForForm,
  fetchProjectSprintsForForm,
} from '@/lib/form-read-actions';
import { cn } from '@repo/ui/lib/utils';
import { useSoftInvalidateHoldAutoRefresh } from '@/lib/soft-invalidate/use-soft-invalidate-hold-auto-refresh';
import { useSoftInvalidateProject } from '@/lib/soft-invalidate/use-soft-invalidate-project';

type WorkItemFormDialogProps = WorkItemFormProps & {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

type FormDialogBootstrap = {
  readonly itemToEdit: DbWorkItem | null;
  readonly projectSprints: readonly WorkItemSprintOption[];
  readonly projectMembers: WorkItemFormProps['projectMembers'];
  readonly detailReady: boolean;
  /** True when this open used dialog-level parallel prefetch. */
  readonly usedBootstrap: boolean;
  readonly loadingLabel: string;
};

/**
 * Keeps the last non-null edit item while the dialog is open so parents can
 * clear `itemToEdit` on close without flashing create (modern) layout mid-exit.
 */
function useStableItemToEdit(
  open: boolean,
  itemToEdit: WorkItemFormProps['itemToEdit']
) {
  const itemRef = useRef(itemToEdit ?? null);
  if (open || itemToEdit != null) {
    itemRef.current = itemToEdit ?? null;
  }
  return itemRef.current;
}

/** Project id known before the form mounts (edit item or locked/single project). */
function resolveBootstrapProjectId(
  item: DbWorkItem | null,
  projects: WorkItemFormProps['projects'],
  lockProject: boolean
): string | null {
  if (item?.project_id) {
    return item.project_id;
  }
  if (lockProject && projects[0]?.id) {
    return projects[0].id;
  }
  if (projects.length === 1 && projects[0]?.id) {
    return projects[0].id;
  }
  return null;
}

/**
 * Prefetch work-item detail (edit) plus project sprints/members in parallel so
 * one dialog spinner covers a ready form — create and edit.
 */
function useFormDialogBootstrap(params: {
  readonly open: boolean;
  readonly stableItemToEdit: DbWorkItem | null;
  readonly projects: WorkItemFormProps['projects'];
  readonly lockProject: boolean;
  readonly fallbackMembers: WorkItemFormProps['projectMembers'];
}): FormDialogBootstrap {
  const { open, stableItemToEdit, projects, lockProject, fallbackMembers } =
    params;
  const bootstrapProjectId = resolveBootstrapProjectId(
    stableItemToEdit,
    projects,
    lockProject
  );

  const [resolvedItem, setResolvedItem] = useState<DbWorkItem | null>(
    stableItemToEdit
  );
  const [projectSprints, setProjectSprints] = useState<
    readonly WorkItemSprintOption[]
  >([]);
  const [projectMembers, setProjectMembers] =
    useState<WorkItemFormProps['projectMembers']>(fallbackMembers);
  const [detailReady, setDetailReady] = useState(
    () => !(stableItemToEdit != null || bootstrapProjectId != null)
  );
  const [usedBootstrap, setUsedBootstrap] = useState(false);

  useEffect(() => {
    if (!open) {
      const needsBootstrapNext =
        stableItemToEdit != null ||
        resolveBootstrapProjectId(stableItemToEdit, projects, lockProject) !=
          null;
      setDetailReady(!needsBootstrapNext);
      setUsedBootstrap(false);
      if (!stableItemToEdit) {
        setResolvedItem(null);
        setProjectSprints([]);
        setProjectMembers(fallbackMembers);
      }
      return;
    }

    const projectId = resolveBootstrapProjectId(
      stableItemToEdit,
      projects,
      lockProject
    );
    const isEdit = stableItemToEdit != null;

    if (!isEdit && !projectId) {
      setResolvedItem(null);
      setProjectSprints([]);
      setProjectMembers(fallbackMembers);
      setUsedBootstrap(false);
      setDetailReady(true);
      return;
    }

    let cancelled = false;
    setDetailReady(false);
    setUsedBootstrap(true);
    setResolvedItem(stableItemToEdit);
    setProjectMembers(fallbackMembers);

    const detailPromise = isEdit
      ? getWorkItemById(stableItemToEdit.id).catch(() => stableItemToEdit)
      : Promise.resolve(null);
    const sprintsPromise = projectId
      ? fetchProjectSprintsForForm(projectId).catch(() => [])
      : Promise.resolve([] as WorkItemSprintOption[]);
    const membersPromise = projectId
      ? fetchProjectMembersForForm(projectId).catch(() => [...fallbackMembers])
      : Promise.resolve([...fallbackMembers]);

    const bootstrapTask = Promise.all([
      detailPromise,
      sprintsPromise,
      membersPromise,
    ]).then(([full, sprints, members]) => {
      if (cancelled) {
        return;
      }
      setResolvedItem(full);
      setProjectSprints(sprints);
      setProjectMembers(members);
      setDetailReady(true);
    });

    return () => {
      cancelled = true;
      bootstrapTask.catch(() => undefined);
    };
    // Key off edit id + bootstrap project so create/subtask also reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional keys
  }, [open, stableItemToEdit?.id, bootstrapProjectId, lockProject]);

  return {
    itemToEdit: resolvedItem,
    projectSprints,
    projectMembers,
    detailReady,
    usedBootstrap,
    loadingLabel: stableItemToEdit ? 'Loading work item…' : 'Loading…',
  };
}

export function WorkItemFormDialog({
  open,
  onOpenChange,
  title,
  description,
  contentClassName,
  titleClassName,
  descriptionClassName,
  itemToEdit = null,
  createFormMode: createFormModeProp,
  projectMembers: projectMembersProp,
  projectSprints: projectSprintsProp,
  preferProvidedSprints: preferProvidedSprintsProp,
  preferProvidedMembers: preferProvidedMembersProp,
  projects,
  lockProject = false,
  ...formProps
}: Readonly<WorkItemFormDialogProps>) {
  const preferredMode = useWorkItemCreateFormMode();
  const [sessionMode, setSessionMode] = useState(
    () => createFormModeProp ?? preferredMode
  );
  const wasOpenRef = useRef(open);
  const stableItemToEdit = useStableItemToEdit(open, itemToEdit);
  const {
    itemToEdit: resolvedItemToEdit,
    projectSprints: bootstrappedSprints,
    projectMembers: bootstrappedMembers,
    detailReady,
    usedBootstrap,
    loadingLabel,
  } = useFormDialogBootstrap({
    open,
    stableItemToEdit,
    projects,
    lockProject,
    fallbackMembers: projectMembersProp,
  });

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSessionMode(createFormModeProp ?? preferredMode);
    }
    wasOpenRef.current = open;
  }, [open, createFormModeProp, preferredMode]);

  const createFormMode = createFormModeProp ?? sessionMode;
  const useModernLayout = createFormMode === 'modern';
  const formKey = resolvedItemToEdit
    ? `${resolvedItemToEdit.id}:${resolvedItemToEdit.updated_at}`
    : `create:${resolveBootstrapProjectId(null, projects, lockProject) ?? 'any'}`;
  const projectSprints = usedBootstrap
    ? bootstrappedSprints
    : (projectSprintsProp ?? []);
  const projectMembers = usedBootstrap
    ? bootstrappedMembers
    : projectMembersProp;
  const softInvalidateProjectId = open
    ? (resolvedItemToEdit?.project_id ??
      resolveBootstrapProjectId(null, projects, lockProject) ??
      null)
    : null;
  useSoftInvalidateHoldAutoRefresh(open);
  useSoftInvalidateProject(softInvalidateProjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          contentClassName,
          useModernLayout ? 'sm:max-w-4xl' : 'sm:max-w-xl',
          'flex max-h-[85vh] flex-col overflow-hidden sm:max-h-[90vh]'
        )}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          if (!useModernLayout || !detailReady) {
            return;
          }
          event.preventDefault();
          const titleInput = document.getElementById(
            'title'
          ) as HTMLInputElement | null;
          if (!titleInput) {
            return;
          }
          titleInput.focus();
          const end = titleInput.value.length;
          titleInput.setSelectionRange(end, end);
        }}
      >
        <DialogHeader className={useModernLayout ? 'sr-only' : undefined}>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {detailReady ? (
          <WorkItemForm
            key={formKey}
            {...formProps}
            projects={projects}
            lockProject={lockProject}
            itemToEdit={resolvedItemToEdit}
            createFormMode={createFormMode}
            projectMembers={projectMembers}
            projectSprints={projectSprints}
            preferProvidedSprints={
              usedBootstrap ? true : preferProvidedSprintsProp
            }
            preferProvidedMembers={
              usedBootstrap ? true : preferProvidedMembersProp
            }
          />
        ) : (
          <div className="text-muted-foreground flex min-h-48 flex-1 items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {loadingLabel}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
