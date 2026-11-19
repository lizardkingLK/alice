'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Layers } from '@repo/ui/lib/icons';
import { WorkItemCreateDraftWarning } from '@/app/work-items/_components/work-item-form/work-item-create-draft-warning';
import { WorkItemFormDialogChrome } from '@/app/work-items/_components/work-item-form/work-item-form-dialog-chrome';
import { workItemFormDialogLayoutClassName } from '@/app/work-items/_components/work-item-form/work-item-form-dialog-layout';
import { useWorkItemFormDialogChromeState } from '@/app/work-items/_components/work-item-form/use-work-item-form-dialog-chrome-state';
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
  /**
   * Bump when the user clicks Create again while this dialog may already be
   * open (floating / minimized). Triggers the draft-in-progress warning for
   * modern create.
   */
  createIntentKey?: number;
};

type FormDialogBootstrap = {
  readonly itemToEdit: DbWorkItem | null;
  readonly projectSprints: readonly WorkItemSprintOption[];
  readonly projectMembers: WorkItemFormProps['projectMembers'];
  /** Always true once open — form mounts immediately (create and edit). */
  readonly detailReady: boolean;
  /** True when dialog-level sprints/members were preferred over form hooks. */
  readonly usedBootstrap: boolean;
  /**
   * Bumps once when full edit detail replaces a list-row stub so the form
   * remounts with TipTap description (and other omitted list fields).
   */
  readonly detailEpoch: number;
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
 * Edit and create both mount the form immediately (no dialog-level spinner).
 * Edit still fetches full detail + sprints/members in the background so
 * TipTap description and options hydrate without blocking first paint.
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
  const [usedBootstrap, setUsedBootstrap] = useState(false);
  const [detailEpoch, setDetailEpoch] = useState(0);

  useEffect(() => {
    if (!open) {
      setUsedBootstrap(false);
      setDetailEpoch(0);
      if (!stableItemToEdit) {
        setResolvedItem(null);
        setProjectSprints([]);
        setProjectMembers(fallbackMembers);
      }
      return;
    }

    const isEdit = stableItemToEdit != null;

    // Create / subtask: show the form immediately. Members/sprints load in-form.
    if (!isEdit) {
      setResolvedItem(null);
      setProjectSprints([]);
      setProjectMembers(fallbackMembers);
      setUsedBootstrap(false);
      setDetailEpoch(0);
      return;
    }

    const projectId = resolveBootstrapProjectId(
      stableItemToEdit,
      projects,
      lockProject
    );

    let cancelled = false;
    // Show the list-row item immediately — do not gate on network.
    setUsedBootstrap(true);
    setResolvedItem(stableItemToEdit);
    setProjectMembers(fallbackMembers);
    setProjectSprints([]);
    setDetailEpoch(0);

    const detailPromise = getWorkItemById(stableItemToEdit.id).catch(
      () => stableItemToEdit
    );
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
      setDetailEpoch(1);
    });

    return () => {
      cancelled = true;
      bootstrapTask.catch(() => undefined);
    };
    // Key off edit id + bootstrap project so reopen/refetch stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional keys
  }, [open, stableItemToEdit?.id, bootstrapProjectId, lockProject]);

  return {
    itemToEdit: resolvedItem,
    projectSprints,
    projectMembers,
    detailReady: true,
    usedBootstrap,
    detailEpoch,
  };
}

function resolveFormKey(args: {
  readonly resolvedItemToEdit: DbWorkItem | null;
  readonly detailEpoch: number;
  readonly projects: WorkItemFormProps['projects'];
  readonly lockProject: boolean;
  readonly createEpoch: number;
}): string {
  const {
    resolvedItemToEdit,
    detailEpoch,
    projects,
    lockProject,
    createEpoch,
  } = args;
  if (resolvedItemToEdit) {
    return `${resolvedItemToEdit.id}:${detailEpoch}:${resolvedItemToEdit.updated_at}`;
  }
  const projectKey =
    resolveBootstrapProjectId(null, projects, lockProject) ?? 'any';
  return `create:${projectKey}:${createEpoch}`;
}

function focusModernTitleInput() {
  const titleInput = document.getElementById(
    'title'
  ) as HTMLInputElement | null;
  if (!titleInput) {
    return;
  }
  titleInput.focus();
  const end = titleInput.value.length;
  titleInput.setSelectionRange(end, end);
}

function resolveSoftInvalidateProjectId(args: {
  readonly open: boolean;
  readonly resolvedItemToEdit: DbWorkItem | null;
  readonly projects: WorkItemFormProps['projects'];
  readonly lockProject: boolean;
}): string | null {
  if (!args.open) {
    return null;
  }
  return (
    args.resolvedItemToEdit?.project_id ??
    resolveBootstrapProjectId(null, args.projects, args.lockProject) ??
    null
  );
}

function useSessionCreateFormMode(
  open: boolean,
  createFormModeProp: WorkItemFormProps['createFormMode'],
  preferredMode: ReturnType<typeof useWorkItemCreateFormMode>
) {
  const [sessionMode, setSessionMode] = useState(
    () => createFormModeProp ?? preferredMode
  );
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSessionMode(createFormModeProp ?? preferredMode);
    }
    wasOpenRef.current = open;
  }, [open, createFormModeProp, preferredMode]);

  return createFormModeProp ?? sessionMode;
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
  createIntentKey,
  ...formProps
}: Readonly<WorkItemFormDialogProps>) {
  const preferredMode = useWorkItemCreateFormMode();
  const createFormMode = useSessionCreateFormMode(
    open,
    createFormModeProp,
    preferredMode
  );
  const stableItemToEdit = useStableItemToEdit(open, itemToEdit);
  const {
    itemToEdit: resolvedItemToEdit,
    projectSprints: bootstrappedSprints,
    projectMembers: bootstrappedMembers,
    detailReady,
    usedBootstrap,
    detailEpoch,
  } = useFormDialogBootstrap({
    open,
    stableItemToEdit,
    projects,
    lockProject,
    fallbackMembers: projectMembersProp,
  });

  const useModernLayout = createFormMode === 'modern';
  const isModernCreate = useModernLayout && resolvedItemToEdit == null;
  const allowFloatMinimize = isModernCreate;
  const chrome = useWorkItemFormDialogChromeState({
    open,
    allowFloatMinimize,
    isModernCreate,
    createIntentKey,
  });

  const formKey = resolveFormKey({
    resolvedItemToEdit,
    detailEpoch,
    projects,
    lockProject,
    createEpoch: chrome.createEpoch,
  });
  const projectSprints = usedBootstrap
    ? bootstrappedSprints
    : (projectSprintsProp ?? []);
  const projectMembers = usedBootstrap
    ? bootstrappedMembers
    : projectMembersProp;
  useSoftInvalidateHoldAutoRefresh(open);
  useSoftInvalidateProject(
    resolveSoftInvalidateProjectId({
      open,
      resolvedItemToEdit,
      projects,
      lockProject,
    })
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        modal={chrome.dialogModal}
      >
        <DialogContent
          showCloseButton={false}
          // Keep overlay mounted for modern create; toggle with `hidden` (not
          // opacity) so float↔default keeps a real bg-black/40 dimmer that also
          // blocks clicks — without a washed-out leftover layer.
          showOverlay={allowFloatMinimize || !chrome.isNonModal}
          overlayClassName={
            allowFloatMinimize && chrome.isNonModal ? 'hidden' : undefined
          }
          dismissOnOutsideClick={false}
          className={cn(
            contentClassName,
            'flex flex-col overflow-hidden',
            // Layout switches should not replay the open zoom (circle morph).
            'data-open:zoom-in-100 data-closed:zoom-out-100 duration-0',
            workItemFormDialogLayoutClassName(chrome.layout, useModernLayout),
            chrome.isMinimized && 'overflow-visible'
          )}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            if (!useModernLayout || !detailReady || chrome.isMinimized) {
              return;
            }
            event.preventDefault();
            focusModernTitleInput();
          }}
        >
          <DialogHeader
            className={cn(
              useModernLayout || chrome.isMinimized ? 'sr-only' : undefined,
              !useModernLayout && !chrome.isMinimized && 'pr-28'
            )}
          >
            <DialogTitle className={titleClassName}>{title}</DialogTitle>
            <DialogDescription className={descriptionClassName}>
              {description}
            </DialogDescription>
          </DialogHeader>

          {chrome.isMinimized ? (
            <button
              type="button"
              className="bg-popover text-popover-foreground hover:bg-muted flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-md"
              aria-label="Restore create dialog"
              onClick={() =>
                chrome.handleLayoutChange(chrome.layoutBeforeMinimize)
              }
            >
              <Layers className="size-4 shrink-0" />
              Create
            </button>
          ) : null}

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col',
              chrome.isMinimized && 'hidden'
            )}
          >
            <WorkItemFormDialogChrome
              layout={chrome.layout}
              modalLayout={chrome.modalLayout}
              allowFloatMinimize={allowFloatMinimize}
              onLayoutChange={chrome.handleLayoutChange}
            />
            {detailReady ? (
              <WorkItemForm
                key={formKey}
                {...formProps}
                projects={projects}
                lockProject={lockProject}
                itemToEdit={resolvedItemToEdit}
                createFormMode={createFormMode}
                dialogLayout={chrome.layout}
                projectMembers={projectMembers}
                projectSprints={projectSprints}
                preferProvidedSprints={
                  usedBootstrap ? true : preferProvidedSprintsProp
                }
                preferProvidedMembers={
                  usedBootstrap ? true : preferProvidedMembersProp
                }
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <WorkItemCreateDraftWarning
        open={chrome.draftWarningOpen}
        onKeepEditing={chrome.handleKeepEditing}
        onDiscardDraft={chrome.handleDiscardDraft}
      />
    </>
  );
}
