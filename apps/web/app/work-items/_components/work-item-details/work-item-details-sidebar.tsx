'use client';

import {
  formatLabelWithSpace,
  formatDate,
  getInitials,
} from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import {
  WORK_ITEM_PATCH_FIELD_CONFIG,
  WORK_ITEM_STATUSES,
  WorkItemFieldPatchDialog,
  type WorkItemPatchMemberOption,
} from '@/app/work-items/_components/work-item-details/work-item-field-patch-dialog';
import { IncompleteSubtasksDoneBlockedDialog } from '@/app/work-items/_components/work-item-subtasks/incomplete-subtasks-done-blocked-dialog';
import { hasIncompleteStatuses } from '@/app/work-items/_helpers/work-item-status';
import { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import {
  parseWorkItemLabels,
  type WorkItemStatus,
  type WorkItemWorkLog,
  ProjectFieldsConfigSchema,
} from '@repo/types';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Button } from '@repo/ui/components/ui/button';
import { ButtonGroup } from '@repo/ui/components/ui/button-group';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from '@repo/ui/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  ChevronDown,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Rocket,
  CheckCircle2,
  Cloud,
  PencilIcon,
  Settings,
  Plus,
  Trash,
  Copy,
  Check,
  ExternalLink,
  Loader2,
} from '@repo/ui/lib/icons';
import { WorkItemTimeTracking } from '@/app/work-items/_components/work-item-work-logs/work-item-time-tracking';
import { cn } from '@repo/ui/lib/utils';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import {
  linkPR,
  unlinkPR,
  updateWorkItem,
} from '@/app/work-items/_services/work-items.mutations.client';
import { SafeDynamicFieldsSection } from './safe-dynamic-fields-section';
import { ProjectFieldsErrorDialog } from '@/app/projects/_components/project-details/project-fields-error-dialog';
import {
  getLinkedPRs,
  type GithubCommit,
  type LinkedGithubPR,
} from '@/app/work-items/_services/work-items.reads.client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { toast } from '@repo/ui/components/ui/sonner';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';

function StatusDropdown({
  workItemId,
  expectedUpdatedAt,
  workItemStatus,
  childStatuses,
  onPatched,
}: Readonly<{
  workItemId: string;
  expectedUpdatedAt: string;
  workItemStatus: DbWorkItem['status'];
  childStatuses: readonly WorkItemStatus[];
  // eslint-disable-next-line no-unused-vars -- callback signature
  onPatched: (updated: Partial<DbWorkItem>) => void;
}>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<DbWorkItem['status']>(workItemStatus);

  const incompleteSubtaskCount = childStatuses.filter(
    (status) => status !== 'Done'
  ).length;

  const handleStatusSelect = (value: string) => {
    const nextStatus = value as DbWorkItem['status'];
    if (nextStatus === workItemStatus) {
      return;
    }
    if (nextStatus === 'Done' && hasIncompleteStatuses(childStatuses)) {
      setBlockedOpen(true);
      return;
    }
    setPendingStatus(nextStatus);
    setDialogOpen(true);
  };

  return (
    <>
      <ButtonGroup className="w-full">
        <Button
          variant="default"
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 justify-start"
        >
          {formatLabelWithSpace(workItemStatus)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="cursor-pointer px-2">
              <ChevronDown />
              <span className="sr-only">Change status</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Change Status</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={workItemStatus}
                onValueChange={handleStatusSelect}
              >
                {WORK_ITEM_STATUSES.map((item) => (
                  <DropdownMenuRadioItem key={item} value={item}>
                    {formatLabelWithSpace(item)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <WorkItemFieldPatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workItemId={workItemId}
        expectedUpdatedAt={expectedUpdatedAt}
        fieldConfig={WORK_ITEM_PATCH_FIELD_CONFIG.status}
        currentValue={pendingStatus}
        onPatched={onPatched}
      />

      <IncompleteSubtasksDoneBlockedDialog
        open={blockedOpen}
        onOpenChange={setBlockedOpen}
        incompleteCount={incompleteSubtaskCount}
      />
    </>
  );
}

function DetailRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3 py-2.5">
      <span className="text-muted-foreground pt-0.5 text-sm">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SidebarCollapsibleHeader({
  title,
  open,
  collapsedHint,
}: Readonly<{
  title: string;
  open: boolean;
  collapsedHint?: string;
}>) {
  return (
    <CardHeader className="px-4 py-3">
      <CollapsibleTrigger
        className="bg-transparent hover:bg-transparent"
        asChild
      >
        <button
          type="button"
          className="hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left transition-colors"
        >
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {!open && collapsedHint ? (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {collapsedHint}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
    </CardHeader>
  );
}

function SidebarCollapsibleSection({
  title,
  open,
  onOpenChange,
  collapsedHint,
  contentClassName,
  children,
}: Readonly<{
  title: string;
  open: boolean;
  // eslint-disable-next-line no-unused-vars -- open-change callback
  onOpenChange: (open: boolean) => void;
  collapsedHint?: string;
  contentClassName?: string;
  children: ReactNode;
}>) {
  return (
    <Card className="border-border gap-0 py-0 shadow-none">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <SidebarCollapsibleHeader
          title={title}
          open={open}
          collapsedHint={collapsedHint}
        />
        <CollapsibleContent>
          <CardContent
            className={cn('border-t px-4 pt-1 pb-4', contentClassName)}
          >
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function UserPill({
  name,
  imageUrl,
  emptyLabel = 'Unassigned',
}: Readonly<{
  name?: string | null;
  imageUrl?: string | null;
  emptyLabel?: string;
}>) {
  const displayName = name?.trim() || emptyLabel;

  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        {imageUrl ? <AvatarImage src={imageUrl} alt={displayName} /> : null}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{displayName}</span>
    </div>
  );
}

/* eslint-disable no-unused-vars */
type EditableUserFieldProps = {
  readonly name?: string | null;
  readonly imageUrl?: string | null;
  readonly field: 'assignee_id' | 'reporter_id';
  readonly onEdit: (field: 'assignee_id' | 'reporter_id') => void;
  readonly readOnly?: boolean;
};
/* eslint-enable no-unused-vars */

function DetailFieldEditButton({
  ariaLabel,
  onClick,
  className,
}: Readonly<{
  ariaLabel: string;
  onClick: () => void;
  className?: string;
}>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('cursor-pointer', className)}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <PencilIcon className="size-3.5" />
    </Button>
  );
}

function EditableUserField({
  name,
  imageUrl,
  field,
  onEdit,
  readOnly = false,
}: Readonly<EditableUserFieldProps>) {
  const config = WORK_ITEM_PATCH_FIELD_CONFIG[field];

  return (
    <div className="flex items-center justify-between gap-2">
      <UserPill
        name={name}
        imageUrl={imageUrl}
        emptyLabel={config.unassignedLabel ?? 'Unassigned'}
      />
      {readOnly ? null : (
        <DetailFieldEditButton
          ariaLabel={`Edit ${config.label.toLowerCase()}`}
          onClick={() => onEdit(field)}
        />
      )}
    </div>
  );
}

function EditableLabelsField({
  labels,
  onEdit,
  readOnly = false,
}: Readonly<{
  readonly labels: readonly string[];
  readonly onEdit: () => void;
  readonly readOnly?: boolean;
}>) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {labels.length === 0 ? (
          <span className="text-muted-foreground text-sm">No labels</span>
        ) : (
          labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))
        )}
      </div>
      {readOnly ? null : (
        <DetailFieldEditButton
          ariaLabel="Edit labels"
          className="shrink-0"
          onClick={onEdit}
        />
      )}
    </div>
  );
}

function parseTextDynamicFields(text: string): Record<string, unknown> {
  const marker = '[Dynamic Fields]';
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    return {};
  }

  const remainder = text.slice(markerIndex + marker.length);
  const content = remainder.startsWith('\n') ? remainder.slice(1) : remainder;
  const lines = content.split('\n');
  const result: Record<string, unknown> = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key) {
        result[key] = val;
      }
    }
  }

  return result;
}

function findDynamicFieldsInContent(
  content: unknown[]
): Record<string, unknown> | null {
  for (const node of content) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    const children = (node as { content?: unknown[] }).content;
    if (!Array.isArray(children)) {
      continue;
    }
    for (const child of children) {
      if (
        child &&
        typeof child === 'object' &&
        typeof (child as { text?: unknown }).text === 'string'
      ) {
        const text = (child as { text: string }).text;
        if (text.includes('[Dynamic Fields]')) {
          return parseTextDynamicFields(text);
        }
      }
    }
  }
  return null;
}

function extractDynamicFieldValues(
  description: unknown
): Record<string, unknown> {
  if (!description || typeof description !== 'object') {
    return {};
  }
  try {
    const doc = description as {
      attrs?: { dynamicFields?: unknown };
      content?: unknown[];
    };
    const df = doc.attrs?.dynamicFields;
    if (df && typeof df === 'object' && !Array.isArray(df)) {
      return df as Record<string, unknown>;
    }
    if (Array.isArray(doc.content)) {
      return findDynamicFieldsInContent(doc.content) ?? {};
    }
  } catch {
    return {};
  }
  return {};
}

function patchWorkItemDynamicFields(
  currentDescription: unknown,
  key: string,
  value: unknown
): DbWorkItem['description'] {
  let doc: {
    type?: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
  };
  if (
    currentDescription &&
    typeof currentDescription === 'object' &&
    !Array.isArray(currentDescription)
  ) {
    doc = { ...(currentDescription as Record<string, unknown>) };
  } else {
    doc = { type: 'doc', content: [] };
  }

  const existingAttrs =
    doc.attrs && typeof doc.attrs === 'object' && !Array.isArray(doc.attrs)
      ? { ...doc.attrs }
      : {};

  const initialFields = extractDynamicFieldValues(currentDescription);
  const existingFields: Record<string, unknown> = {
    ...initialFields,
    ...(existingAttrs.dynamicFields &&
    typeof existingAttrs.dynamicFields === 'object' &&
    !Array.isArray(existingAttrs.dynamicFields)
      ? (existingAttrs.dynamicFields as Record<string, unknown>)
      : {}),
  };

  if (value === undefined || value === null || value === '') {
    delete existingFields[key];
  } else {
    existingFields[key] = value;
  }

  existingAttrs.dynamicFields = existingFields;
  doc.attrs = existingAttrs;
  return doc as DbWorkItem['description'];
}

export default function WorkItemSidebar({
  workItem,
  childStatuses = [],
  projectMembers = [],
  project,
  workLogs = [],
  detailsOpen,
  setDetailsOpen,
  moreFieldsOpen,
  setMoreFieldsOpen,
  onWorkItemPatched,
  onLogWorkClick,
  readOnly = false,
}: Readonly<{
  workItem: DbWorkItem;
  childStatuses?: readonly WorkItemStatus[];
  projectMembers?: readonly WorkItemPatchMemberOption[];
  project?: DbProject | null;
  workLogs?: WorkItemWorkLog[];
  detailsOpen: boolean;
  setDetailsOpen: Dispatch<SetStateAction<boolean>>;
  moreFieldsOpen: boolean;
  // eslint-disable-next-line no-unused-vars -- open-change callback
  setMoreFieldsOpen: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onWorkItemPatched: (updated: Partial<DbWorkItem>) => void;
  onLogWorkClick?: () => void;
  readOnly?: boolean;
}>) {
  const [activeField, setActiveField] = useState<
    'assignee_id' | 'reporter_id' | 'labels' | null
  >(null);
  const [developmentOpen, setDevelopmentOpen] = useState(true);
  const [additionalFieldsOpen, setAdditionalFieldsOpen] = useState(true);
  const labels = parseWorkItemLabels(workItem.labels);

  const hasValidDynamicFields = useMemo(() => {
    if (!project?.attributes_config) return false;
    const validated = ProjectFieldsConfigSchema.safeParse(
      project.attributes_config
    );
    return (
      validated.success &&
      Boolean(validated.data.properties) &&
      Object.keys(validated.data.properties).length > 0
    );
  }, [project?.attributes_config]);

  const dynamicFieldValues = useMemo(() => {
    return extractDynamicFieldValues(workItem.description);
  }, [workItem.description]);

  const [dynamicFieldsError, setDynamicFieldsError] = useState<string | null>(
    null
  );

  const latestUpdatedAtRef = useRef(workItem.updated_at);
  const latestDescriptionRef = useRef(workItem.description);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    latestUpdatedAtRef.current = workItem.updated_at;
  }, [workItem.updated_at]);

  useEffect(() => {
    latestDescriptionRef.current = workItem.description;
  }, [workItem.description]);

  const handleDynamicFieldChange = useCallback(
    (key: string, value: unknown) => {
      mutationQueueRef.current = mutationQueueRef.current
        .then(async () => {
          const currentDesc = latestDescriptionRef.current;
          const currentUpdated = latestUpdatedAtRef.current;
          const updatedDescription = patchWorkItemDynamicFields(
            currentDesc,
            key,
            value
          );
          latestDescriptionRef.current = updatedDescription;

          // Optimistically notify parent so UI updates immediately
          onWorkItemPatched({
            description: updatedDescription as DbWorkItem['description'],
          });

          const formData = new FormData();
          formData.set('description', JSON.stringify(updatedDescription));
          const res = await updateWorkItem(
            workItem.id,
            formData,
            currentUpdated
          );
          if (res.data) {
            latestUpdatedAtRef.current = res.data.updated_at;
            onWorkItemPatched({
              description: updatedDescription as DbWorkItem['description'],
              updated_at: res.data.updated_at,
            });
          }
        })
        .catch((err) => {
          const msg =
            err instanceof Error
              ? err.message
              : 'Failed to update dynamic field';
          setDynamicFieldsError(msg);
        });
    },
    [workItem.id, onWorkItemPatched]
  );

  const activeConfig = activeField
    ? WORK_ITEM_PATCH_FIELD_CONFIG[activeField]
    : null;

  let currentValue: string | null = null;
  if (activeField === 'assignee_id') {
    currentValue = workItem.assignee_id;
  } else if (activeField === 'reporter_id') {
    currentValue = workItem.reporter_id;
  }

  return (
    <aside className="space-y-4 lg:col-span-2">
      <StatusDropdown
        workItemId={workItem.id}
        expectedUpdatedAt={workItem.updated_at}
        workItemStatus={workItem.status}
        childStatuses={childStatuses}
        onPatched={onWorkItemPatched}
      />

      <SidebarCollapsibleSection
        title="Details"
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      >
        <DetailRow label="Assignee">
          <EditableUserField
            name={workItem.assignee?.name}
            imageUrl={workItem.assignee?.profile_picture}
            field="assignee_id"
            onEdit={setActiveField}
            readOnly={readOnly}
          />
        </DetailRow>
        <DetailRow label="Reporter">
          <EditableUserField
            name={workItem.reporter?.name}
            imageUrl={workItem.reporter?.profile_picture}
            field="reporter_id"
            onEdit={setActiveField}
            readOnly={readOnly}
          />
        </DetailRow>
        <DetailRow label="Priority">
          <PriorityBadge priority={workItem.priority} />
        </DetailRow>
        <DetailRow label="Labels">
          <EditableLabelsField
            labels={labels}
            onEdit={() => setActiveField('labels')}
            readOnly={readOnly}
          />
        </DetailRow>
      </SidebarCollapsibleSection>

      {hasValidDynamicFields && (
        <SidebarCollapsibleSection
          title="Additional Fields"
          open={additionalFieldsOpen}
          onOpenChange={setAdditionalFieldsOpen}
          collapsedHint={`${
            Object.keys(
              (project?.attributes_config as { properties?: Record<string, unknown> })?.properties || {}
            ).length
          } project fields`}
        >
          <SafeDynamicFieldsSection
            schema={project?.attributes_config}
            values={dynamicFieldValues}
            onFieldChange={handleDynamicFieldChange}
            readOnly={readOnly}
          />
        </SidebarCollapsibleSection>
      )}

      <SidebarCollapsibleSection
        title="Development"
        open={developmentOpen}
        onOpenChange={setDevelopmentOpen}
        collapsedHint="Branches, PRs, builds, releases…"
      >
        <DevelopmentSection workItem={workItem} readOnly={readOnly} />

        <DetailRow label="Releases">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <Cloud className="text-muted-foreground size-3.5" />
                Production
              </span>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto cursor-pointer px-0"
            >
              + Add feature flag
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-muted-foreground h-auto cursor-pointer px-0"
            >
              See all deployments
            </Button>
          </div>
        </DetailRow>
      </SidebarCollapsibleSection>

      <SidebarCollapsibleSection
        title="More fields"
        open={moreFieldsOpen}
        onOpenChange={setMoreFieldsOpen}
        collapsedHint="Time tracking, automation, reminders…"
        contentClassName="text-muted-foreground space-y-3 pt-3 text-sm"
      >
        <WorkItemTimeTracking
          storyPoints={workItem.story_points}
          workLogs={workLogs}
          onLogWorkClick={readOnly ? undefined : onLogWorkClick}
        />

        <DetailRow label="Due date">
          <span>{formatDate(workItem.due_date)}</span>
        </DetailRow>
        <DetailRow label="Story points">
          <span>{workItem.story_points ?? '—'}</span>
        </DetailRow>
        <DetailRow label="Sprint">
          <span>{workItem.sprint_id ? 'Assigned' : 'Backlog'}</span>
        </DetailRow>
      </SidebarCollapsibleSection>

      <div className="text-muted-foreground space-y-1 px-1 text-xs">
        <p>Created {formatDate(workItem.created_at)}</p>
        <p>Updated {formatDate(workItem.updated_at)}</p>
        {workItem.status === 'Done' ? (
          <p>Resolved {formatDate(workItem.updated_at)}</p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="cursor-pointer">
          <Settings data-icon="inline-start" />
          Configure
        </Button>
      </div>

      {activeConfig ? (
        <WorkItemFieldPatchDialog
          open={!!activeField}
          onOpenChange={(open) => {
            if (!open) {
              setActiveField(null);
            }
          }}
          workItemId={workItem.id}
          expectedUpdatedAt={workItem.updated_at}
          fieldConfig={activeConfig}
          options={projectMembers}
          currentValue={currentValue}
          currentLabels={labels}
          onPatched={onWorkItemPatched}
        />
      ) : null}

      <ProjectFieldsErrorDialog
        open={Boolean(dynamicFieldsError)}
        title="Dynamic Field Update Error"
        description="Could not save the updated field value to this work item."
        error={dynamicFieldsError}
        onClose={() => setDynamicFieldsError(null)}
      />
    </aside>
  );
}

function getPrStatusColors(status: string) {
  if (status === 'merged') {
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
  }
  if (status === 'closed') {
    return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  }
  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
}

/* eslint-disable no-unused-vars */
interface BranchesRowProps {
  branches: string[];
  branchesExpanded: boolean;
  setBranchesExpanded: (_expanded: boolean) => void;
  copiedBranchId: string | null;
  copyToClipboard: (_text: string, _id: string) => void;
}
/* eslint-enable no-unused-vars */

function BranchesRow({
  branches,
  branchesExpanded,
  setBranchesExpanded,
  copiedBranchId,
  copyToClipboard,
}: Readonly<BranchesRowProps>) {
  const branchCount = branches.length;
  return (
    <li className="space-y-2">
      <button
        type="button"
        onClick={() => setBranchesExpanded(!branchesExpanded)}
        className="hover:text-primary flex w-full cursor-pointer items-center justify-between gap-2 text-left transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <GitBranch className="text-muted-foreground size-3.5 shrink-0" />
          <span>
            {branchCount} {branchCount === 1 ? 'branch' : 'branches'}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform',
            branchesExpanded && 'rotate-180'
          )}
        />
      </button>
      {branchesExpanded && (
        <div className="space-y-2 pt-0.5 pl-5.5">
          {branches.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No branches linked. Link a pull request to sync branches.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {branches.map((b) => (
                <li
                  key={b}
                  className="bg-muted/40 flex items-center justify-between gap-2 rounded px-2.5 py-1 text-xs"
                >
                  <span className="truncate font-mono">{b}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(b, b);
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  >
                    {copiedBranchId === b ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* eslint-disable no-unused-vars */
interface CommitsRowProps {
  commits: (GithubCommit & { prId: string; prNumber: number })[];
  commitsExpanded: boolean;
  setCommitsExpanded: (_expanded: boolean) => void;
}
/* eslint-enable no-unused-vars */

function CommitsRow({
  commits,
  commitsExpanded,
  setCommitsExpanded,
}: Readonly<CommitsRowProps>) {
  const commitCount = commits.length;
  return (
    <li className="space-y-2">
      <button
        type="button"
        onClick={() => setCommitsExpanded(!commitsExpanded)}
        className="hover:text-primary flex w-full cursor-pointer items-center justify-between gap-2 text-left transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <GitCommit className="text-muted-foreground size-3.5 shrink-0" />
          <span>
            {commitCount} {commitCount === 1 ? 'commit' : 'commits'}
          </span>
        </span>
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-xs">
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              commitsExpanded && 'rotate-180'
            )}
          />
        </span>
      </button>
      {commitsExpanded && (
        <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto pt-0.5 pl-5.5">
          {commits.length === 0 ? (
            <p className="text-muted-foreground text-xs">No commits found.</p>
          ) : (
            <ul className="space-y-2 border-l pl-2.5">
              {commits.map((c) => (
                <li
                  key={c.sha}
                  className="space-y-0.5 font-sans text-[11px] leading-tight"
                >
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span className="truncate font-semibold">{c.author}</span>
                    <span className="bg-muted/60 shrink-0 rounded px-1 font-mono text-[9px]">
                      {c.sha}
                    </span>
                  </div>
                  <p className="text-foreground line-clamp-1 font-medium">
                    {c.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* eslint-disable no-unused-vars */
interface PRsRowProps {
  prs: LinkedGithubPR[];
  prsExpanded: boolean;
  setPrsExpanded: (_expanded: boolean) => void;
  readOnly: boolean;
  onUnlink: (_prId: string) => void;
  onOpenLinkDialog: () => void;
}
/* eslint-enable no-unused-vars */

function PRsRow({
  prs,
  prsExpanded,
  setPrsExpanded,
  readOnly,
  onUnlink,
  onOpenLinkDialog,
}: Readonly<PRsRowProps>) {
  const prCount = prs.length;
  return (
    <li className="space-y-2">
      <button
        type="button"
        onClick={() => setPrsExpanded(!prsExpanded)}
        className="hover:text-primary flex w-full cursor-pointer items-center justify-between gap-2 text-left transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <GitPullRequest className="text-muted-foreground size-3.5 shrink-0" />
          <span>
            {prCount} {prCount === 1 ? 'pull request' : 'pull requests'}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <ChevronDown
            className={cn(
              'text-muted-foreground h-3.5 w-3.5 transition-transform',
              prsExpanded && 'rotate-180'
            )}
          />
        </span>
      </button>
      {prsExpanded && (
        <div className="space-y-2.5 pt-0.5 pl-5.5">
          {prs.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No pull requests linked.
            </p>
          ) : (
            <ul className="space-y-2">
              {prs.map((pr) => {
                return (
                  <li
                    key={pr.id}
                    className="bg-muted/10 space-y-1 rounded-md border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-[10px] font-semibold">
                        #{pr.pr_number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-1 py-0 text-[8px] font-bold uppercase',
                            getPrStatusColors(pr.status)
                          )}
                        >
                          {pr.status || 'open'}
                        </Badge>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnlink(pr.id);
                            }}
                            className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                            title="Unlink PR"
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <a
                        href={pr.pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary group line-clamp-1 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                      >
                        {pr.pr_title}
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenLinkDialog}
              className="h-7 w-full py-1 text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              Link Pull Request
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function DevelopmentSection({
  workItem,
  readOnly = false,
}: Readonly<{
  workItem: DbWorkItem;
  readOnly?: boolean;
}>) {
  const [githubLinks, setGithubLinks] = useState<LinkedGithubPR[]>([]);
  const [githubRepo, setGithubRepo] = useState<string | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [prUrlInput, setPrUrlInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);
  const [branchesExpanded, setBranchesExpanded] = useState(false);
  const [commitsExpanded, setCommitsExpanded] = useState(false);
  const [prsExpanded, setPrsExpanded] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const fetchGithubLinks = useCallback(async () => {
    setLoadingGithub(true);
    try {
      const data = await getLinkedPRs(workItem.id);
      setGithubLinks(data.prs);
      setGithubRepo(data.githubRepo);
    } catch (e) {
      console.error('Failed to load GitHub PRs:', e);
    } finally {
      setLoadingGithub(false);
    }
  }, [workItem.id]);

  useEffect(() => {
    fetchGithubLinks();
  }, [fetchGithubLinks]);

  const handleLinkPRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = prUrlInput.trim();
    if (!url) return;

    setLinkError(null);

    const githubPrRegex =
      /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/;
    const match = githubPrRegex.exec(url);
    if (!match) {
      setLinkError(
        'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/number'
      );
      return;
    }

    const repoOwner = match[1]!;
    const repoName = match[2]!;

    if (githubRepo) {
      const [configOwner, configRepo] = githubRepo.split('/');
      if (
        !configOwner ||
        !configRepo ||
        repoOwner.toLowerCase() !== configOwner.toLowerCase() ||
        repoName.toLowerCase() !== configRepo.toLowerCase()
      ) {
        setLinkError(
          `PR does not belong to the project's configured GitHub repository: ${githubRepo}`
        );
        return;
      }
    }

    setIsLinking(true);
    try {
      await linkPR(workItem.id, url);
      setPrUrlInput('');
      setLinkDialogOpen(false);
      fetchGithubLinks();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Failed to link pull request';
      setLinkError(message);
      toast.error(message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkPR = async (prId: string) => {
    try {
      await unlinkPR(workItem.id, prId);
      fetchGithubLinks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to unlink pull request');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBranchId(id);
      setTimeout(() => setCopiedBranchId(null), 2000);
      toast.success('Branch name copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const branches = Array.from(
    new Set(githubLinks.map((l) => l.branch_name).filter(Boolean) as string[])
  );

  const allCommits = githubLinks.flatMap((pr) =>
    (pr.commits || []).map((c) => ({
      ...c,
      prId: pr.id,
      prNumber: pr.pr_number,
    }))
  );

  let content: React.ReactNode;

  if (loadingGithub) {
    content = (
      <div className="flex justify-center py-4">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  } else if (!githubRepo) {
    content = (
      <div className="bg-muted/5 my-1 flex flex-col items-center justify-center space-y-2.5 rounded-md border border-dashed p-4 text-center">
        <p className="text-muted-foreground text-xs font-medium">
          GitHub Integration is not configured for this project.
        </p>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/projects/${workItem.project_id}?tab=settings`;
            }}
            className="h-8 cursor-pointer px-4 text-xs"
          >
            Configure the GitHub Repository
          </Button>
        )}
      </div>
    );
  } else {
    content = (
      <ul className="space-y-3.5 text-sm">
        <BranchesRow
          branches={branches}
          branchesExpanded={branchesExpanded}
          setBranchesExpanded={setBranchesExpanded}
          copiedBranchId={copiedBranchId}
          copyToClipboard={copyToClipboard}
        />
        <CommitsRow
          commits={allCommits}
          commitsExpanded={commitsExpanded}
          setCommitsExpanded={setCommitsExpanded}
        />
        <PRsRow
          prs={githubLinks}
          prsExpanded={prsExpanded}
          setPrsExpanded={setPrsExpanded}
          readOnly={readOnly}
          onUnlink={handleUnlinkPR}
          onOpenLinkDialog={() => setLinkDialogOpen(true)}
        />
        {/* Builds Row */}
        <li className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <Rocket className="text-muted-foreground size-3.5 shrink-0" />
            <span>{githubLinks.length > 0 ? '1 build' : '0 builds'}</span>
          </span>
          {githubLinks.length > 0 ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs">—</span>
          )}
        </li>
      </ul>
    );
  }

  return (
    <div className="py-2.5">
      {content}

      <Dialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) {
            setLinkError(null);
            setPrUrlInput('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleLinkPRSubmit}>
            <DialogHeader>
              <DialogTitle>Link GitHub Pull Request</DialogTitle>
              <DialogDescription>
                Paste the GitHub Pull Request URL to link it to this work item.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {linkError && <FormStatusAlerts error={linkError} />}
              <div className="space-y-2">
                <Input
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={prUrlInput}
                  onChange={(e) => {
                    setPrUrlInput(e.target.value);
                    if (linkError) setLinkError(null);
                  }}
                  disabled={isLinking}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPrUrlInput('');
                  setLinkDialogOpen(false);
                  setLinkError(null);
                }}
                disabled={isLinking}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLinking}>
                {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Link Pull Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
