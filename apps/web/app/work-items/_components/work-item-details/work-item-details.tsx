'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  getAllowedChildType,
  type WorkItemType,
  type WorkItemStatus,
  type AttachmentWithUploader,
  type Json,
  type WorkItemActivity,
  type WorkItemLinkListItem,
  type WorkItemWorkLog,
} from '@repo/types';
import type { JSONContent } from '@tiptap/react';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import { WorkItemLinkSubtaskDialog } from '@/app/work-items/_components/work-item-subtasks/work-item-link-subtask-dialog';
import {
  DbWorkItem,
  type WorkItemAncestor,
} from '@/app/work-items/_services/work-items.reads.server';
import { AttachmentsSection } from '@/app/work-items/_components/work-item-attachments/work-item-attachments-section';
import {
  WorkItemActivityTabs,
  type WorkItemActivityTab,
} from '@/app/work-items/_components/work-item-details/work-item-activity-tabs';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Progress } from '@repo/ui/components/ui/progress';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@repo/ui/components/ui/table';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  Link2,
  MessageSquare,
  Paperclip,
  PencilIcon,
  Plus,
  RefreshCw,
} from '@repo/ui/lib/icons';
import WorkItemDescriptionEditor from '@/app/work-items/_components/work-item-description/work-item-description-editor';
import { DescriptionView } from '@/app/work-items/_components/work-item-description/work-item-description-view';
import { toTiptapContent } from '@/app/work-items/_helpers/work-item-description';
import { updateWorkItem } from '@/app/work-items/_services/work-items.mutations.client';
import { WorkItemWorkLogDialog } from '@/app/work-items/_components/work-item-work-logs/work-item-work-log-dialog';
import { createWorkItemWorkLog } from '@/app/worklogs/_services/worklogs.mutations.client';
import { useWorkItemLifecycleActions } from '@/app/work-items/_hooks/use-work-item-lifecycle-actions';
import WorkItemSidebar from '@/app/work-items/_components/work-item-details/work-item-details-sidebar';
import { WorkItemSummaryBanner } from '@/app/work-items/_components/work-item-details/work-item-summary-banner';
import { WorkItemPathBreadcrumb } from '@/app/work-items/_components/work-item-path-breadcrumb';
import { SubtaskOrderByMenu } from '@/app/work-items/_components/work-item-subtasks/subtask-order-by-menu';
import {
  UnlinkSubtaskButton,
  WorkItemUnlinkSubtaskDialog,
} from '@/app/work-items/_components/work-item-subtasks/work-item-unlink-subtask-dialog';
import { WorkItemLinkIssueDialog } from '@/app/work-items/_components/work-item-links/work-item-link-issue-dialog';
import {
  UnlinkIssueButton,
  WorkItemUnlinkIssueDialog,
} from '@/app/work-items/_components/work-item-links/work-item-unlink-issue-dialog';
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/work-item-details/work-item-field-patch-dialog';
import type { WorkItemSprintOption } from '@/app/work-items/_helpers/work-item-sprint';
import { formatWorkItemKey } from '@/app/work-items/_helpers/work-item-key';
import { averageStatusCompletionPercent } from '@/app/work-items/_helpers/work-item-status';
import {
  sortSubtasks,
  type SubtaskSortDirection,
  type SubtaskSortField,
} from '@/app/work-items/_helpers/work-item-sort-subtasks';
import {
  buildActivityValueLookups,
  type ActivityValueLookups,
} from '@/app/work-items/_helpers/work-item-activity-format';
import {
  applyRealtimeActivityChange,
  type ActivityRealtimeRow,
} from '@/app/work-items/_helpers/apply-realtime-activity-row';
import {
  applyRealtimeWorkLogChange,
  type WorkLogRealtimeRow,
} from '@/app/work-items/_helpers/apply-realtime-work-log-row';
import { rowFromRealtimePayload } from '@/lib/realtime/realtime-change-row';
import { useScopedTableRealtime } from '@/lib/realtime/use-scoped-table-realtime';
import {
  readMoreFieldsOpen,
  writeMoreFieldsOpen,
} from '@/app/work-items/_helpers/work-item-sidebar-storage';
import {
  DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
  normalizeWorkItemDetailsPreferences,
  readWorkItemDetailsPreferencesLocal,
  writeWorkItemDetailsPreferences,
  type WorkItemDetailsPreferences,
} from '@/app/work-items/_helpers/work-item-details-preferences';
import { toast } from '@repo/ui/components/ui/sonner';
import { CommentItem } from '@/app/comments/_services/comments.mutations.client';
import type { CommentWorkItemOption } from '@/app/comments/_services/comments.mutations.shared';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { OnlineMembersAvatarGroup } from '@/components/online-members-avatar-group';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { UserAvatar } from '@/components/user-avatar';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { useOptimisticPending } from '@/lib/optimistic-lock/use-optimistic-pending';
import { useOptimisticPendingHydrate } from '@/lib/optimistic-lock/use-optimistic-pending-hydrate';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';

function validateWorkLogInputs(
  loggedHoursInput: string,
  loggedAtInput: string
): string | null {
  const nextHours = Number(loggedHoursInput);
  if (!Number.isFinite(nextHours) || nextHours <= 0) {
    return 'Enter a valid amount of hours.';
  }
  if (!loggedAtInput) {
    return 'Please provide a date for the work log.';
  }
  return null;
}

function resolveDiscussionWorkItems(
  provided: readonly CommentWorkItemOption[],
  workItem: DbWorkItem
): CommentWorkItemOption[] {
  if (provided.length > 0) {
    return [...provided];
  }
  return [
    {
      id: workItem.id,
      title: workItem.title,
      key: formatWorkItemKey(workItem),
      type: workItem.type,
      project_id: workItem.project_id || '',
    },
  ];
}

function clearArchivedRecordStatus(prev: DbWorkItem): DbWorkItem {
  return {
    ...prev,
    record_status: 'active',
    ...(prev.parent_id ? { parent_id: null } : {}),
  };
}

function WorkItemArchivedBanner({
  isPending,
  onRestore,
}: Readonly<{
  isPending: boolean;
  onRestore: () => void;
}>) {
  return (
    <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium">This work item is archived</p>
        <p className="text-muted-foreground text-sm">
          It is hidden from the board, calendar, and active lists. Restore it to
          edit again.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0 cursor-pointer self-start"
        disabled={isPending}
        onClick={onRestore}
      >
        <RefreshCw data-icon="inline-start" />
        Restore
      </Button>
    </div>
  );
}

function WorkItemDetailsActionStrip({
  readOnly,
  canAttach,
  canCreateSubtask,
  canLinkIssue,
  onAttach,
  onCreateSubtask,
  onLinkIssue,
}: Readonly<{
  readonly readOnly: boolean;
  readonly canAttach: boolean;
  readonly canCreateSubtask: boolean;
  readonly canLinkIssue: boolean;
  readonly onAttach: () => void;
  readonly onCreateSubtask: () => void;
  readonly onLinkIssue: () => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {readOnly || !canAttach ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={onAttach}
        >
          <Paperclip data-icon="inline-start" />
          Attach
        </Button>
      )}
      {canCreateSubtask ? (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={onCreateSubtask}
        >
          <Plus data-icon="inline-start" />
          Create subtask
        </Button>
      ) : null}
      {readOnly || !canLinkIssue ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={onLinkIssue}
        >
          <Link2 data-icon="inline-start" />
          Link issue
        </Button>
      )}
    </div>
  );
}

/** Shared shape for linkable / unlinkable child refs on details. */
type WorkItemChildRef = Pick<
  DbWorkItem,
  'id' | 'title' | 'type' | 'updated_at'
>;

/* eslint-disable no-unused-vars -- callback prop signatures */
type WorkItemSubtasksSectionProps = {
  readonly items: readonly DbWorkItem[];
  readonly childCommentCounts: Readonly<Record<string, number>>;
  readonly childDonePercent: number;
  readonly canCreateSubtask: boolean;
  readonly readOnly: boolean;
  readonly sortField: SubtaskSortField;
  readonly sortDirection: SubtaskSortDirection;
  readonly onSortFieldChange: (field: SubtaskSortField) => void;
  readonly onSortDirectionChange: (direction: SubtaskSortDirection) => void;
  readonly onLinkExisting: () => void;
  readonly onUnlink: (child: WorkItemChildRef) => void;
  readonly isUserOnline: (userId: string) => boolean;
};
/* eslint-enable no-unused-vars */

function WorkItemSubtasksSection({
  items,
  childCommentCounts,
  childDonePercent,
  canCreateSubtask,
  readOnly,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
  onLinkExisting,
  onUnlink,
  isUserOnline,
}: Readonly<WorkItemSubtasksSectionProps>) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Subtasks</h2>
        <div className="flex items-center gap-1">
          <SubtaskOrderByMenu
            sortField={sortField}
            sortDirection={sortDirection}
            onSortFieldChange={onSortFieldChange}
            onSortDirectionChange={onSortDirectionChange}
          />
          {canCreateSubtask ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Link existing subtask"
              title="Link existing subtask"
              onClick={onLinkExisting}
            >
              <Plus />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Progress value={childDonePercent} className="h-1.5 flex-1" />
        <span className="text-muted-foreground shrink-0 text-xs">
          {childDonePercent}% Done
        </span>
      </div>

      {items.length === 0 ? (
        <div
          className={cn(
            'text-muted-foreground flex h-16 items-center justify-center rounded-lg border border-dashed text-sm'
          )}
        >
          No subtasks yet
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table className="min-w-xl table-fixed">
            <colgroup>
              <col className="w-28" />
              <col />
              <col className="w-12" />
              <col className="w-24" />
              <col className="w-10" />
              <col className="w-28" />
              <col className="w-10" />
            </colgroup>
            <TableBody>
              {items.map((child) => (
                <TableRow
                  key={child.id}
                  className="hover:bg-muted/40 border-border"
                >
                  <TableCell className="px-3 py-2.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {formatWorkItemKey(child)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-0 p-0 whitespace-normal">
                    <Link
                      href={`/work-items/${child.id}`}
                      className="hover:text-primary block min-w-0 px-2 py-2.5"
                    >
                      <TruncatedText className="text-sm">
                        {child.title}
                      </TruncatedText>
                    </Link>
                  </TableCell>
                  <TableCell className="px-2 py-2.5">
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <MessageSquare className="size-3.5 shrink-0" />
                      {childCommentCounts[child.id] ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-2.5">
                    <PriorityBadge priority={child.priority} />
                  </TableCell>
                  <TableCell className="px-2 py-2.5">
                    <UserAvatar
                      name={child.assignee?.name}
                      title={child.assignee?.name ?? 'Unassigned'}
                      isOnline={Boolean(
                        child.assignee_id && isUserOnline(child.assignee_id)
                      )}
                      className="border-0"
                      fallbackClassName="text-xs font-normal"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <WorkItemStatusBadge status={child.status} />
                  </TableCell>
                  <TableCell className="px-1 py-2.5">
                    {readOnly ? null : (
                      <UnlinkSubtaskButton
                        onClick={() =>
                          onUnlink({
                            id: child.id,
                            title: child.title,
                            type: child.type,
                            updated_at: child.updated_at,
                          })
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

type LinkedIssueUnlinkTarget = {
  readonly linkId: string;
  readonly relatedTitle: string;
};

/* eslint-disable no-unused-vars -- callback prop signatures */
type WorkItemLinkedIssuesSectionProps = {
  readonly links: readonly WorkItemLinkListItem[];
  readonly readOnly: boolean;
  readonly onLinkIssue: () => void;
  readonly onUnlink: (target: LinkedIssueUnlinkTarget) => void;
};
/* eslint-enable no-unused-vars */

function WorkItemLinkedIssuesSection({
  links,
  readOnly,
  onLinkIssue,
  onUnlink,
}: Readonly<WorkItemLinkedIssuesSectionProps>) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Linked issues</h2>
        {readOnly ? null : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Link issue"
            title="Link issue"
            onClick={onLinkIssue}
          >
            <Plus />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm">relates to</p>
      {links.length === 0 ? (
        <div
          className={cn(
            'text-muted-foreground flex h-16 items-center justify-center rounded-lg border border-dashed text-sm'
          )}
        >
          No linked issues yet
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table className="min-w-xl table-fixed">
            <colgroup>
              <col className="w-28" />
              <col />
              <col className="w-28" />
              <col className="w-10" />
            </colgroup>
            <TableBody>
              {links.map((link) => (
                <TableRow
                  key={link.id}
                  className="hover:bg-muted/40 border-border"
                >
                  <TableCell className="px-3 py-2.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {formatWorkItemKey({ id: link.related.id })}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-0 p-0 whitespace-normal">
                    <Link
                      href={`/work-items/${link.related.id}`}
                      className="hover:text-primary block min-w-0 px-2 py-2.5"
                    >
                      <TruncatedText className="text-sm">
                        {link.related.title}
                      </TruncatedText>
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <WorkItemStatusBadge
                      status={link.related.status as WorkItemStatus}
                    />
                  </TableCell>
                  <TableCell className="px-1 py-2.5">
                    {readOnly ? null : (
                      <UnlinkIssueButton
                        onClick={() =>
                          onUnlink({
                            linkId: link.id,
                            relatedTitle: link.related.title,
                          })
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/* eslint-disable no-unused-vars -- callback prop signatures */
type WorkItemDetailsMainColumnProps = {
  readonly workItem: DbWorkItem;
  readonly isRecordReadOnly: boolean;
  readonly isEditing: boolean;
  readonly setEditing: Dispatch<SetStateAction<boolean>>;
  readonly descriptionContent: JSONContent | null;
  readonly onDescriptionSave: (content: JSONContent) => Promise<void>;
  readonly sections: WorkItemDetailsPreferences['sections'];
  readonly initialAttachments: readonly AttachmentWithUploader[];
  readonly attachmentUploadOpen: boolean;
  readonly setAttachmentUploadOpen: Dispatch<SetStateAction<boolean>>;
  readonly showSubtasks: boolean;
  readonly sortedChildWorkItems: readonly DbWorkItem[];
  readonly childCommentCounts: Readonly<Record<string, number>>;
  readonly childDonePercent: number;
  readonly canCreateSubtask: boolean;
  readonly subtaskSortField: SubtaskSortField;
  readonly subtaskSortDirection: SubtaskSortDirection;
  readonly setSubtaskSortField: Dispatch<SetStateAction<SubtaskSortField>>;
  readonly setSubtaskSortDirection: Dispatch<
    SetStateAction<SubtaskSortDirection>
  >;
  readonly onLinkExistingSubtask: () => void;
  readonly onUnlinkSubtask: (child: WorkItemChildRef) => void;
  readonly linkedIssues: readonly WorkItemLinkListItem[];
  readonly onLinkIssue: () => void;
  readonly onUnlinkIssue: (target: LinkedIssueUnlinkTarget) => void;
  readonly isUserOnline: (userId: string) => boolean;
  readonly activityTab: WorkItemActivityTab;
  readonly setActivityTab: Dispatch<SetStateAction<WorkItemActivityTab>>;
  readonly initialComments: CommentItem[];
  readonly activities: WorkItemActivity[];
  readonly activityLookups: ActivityValueLookups;
  readonly discussionWorkItems: CommentWorkItemOption[];
  readonly currentUserId?: string;
  readonly workLogs: WorkItemWorkLog[];
  readonly onAddWorkLogClick?: () => void;
  readonly onlineMembersSlot?: ReactNode;
};
/* eslint-enable no-unused-vars */

function WorkItemDetailsMainColumn({
  workItem,
  isRecordReadOnly,
  isEditing,
  setEditing,
  descriptionContent,
  onDescriptionSave,
  sections,
  initialAttachments,
  attachmentUploadOpen,
  setAttachmentUploadOpen,
  showSubtasks,
  sortedChildWorkItems,
  childCommentCounts,
  childDonePercent,
  canCreateSubtask,
  subtaskSortField,
  subtaskSortDirection,
  setSubtaskSortField,
  setSubtaskSortDirection,
  onLinkExistingSubtask,
  onUnlinkSubtask,
  linkedIssues,
  onLinkIssue,
  onUnlinkIssue,
  isUserOnline,
  activityTab,
  setActivityTab,
  initialComments,
  activities,
  activityLookups,
  discussionWorkItems,
  currentUserId,
  workLogs,
  onAddWorkLogClick,
  onlineMembersSlot,
}: Readonly<WorkItemDetailsMainColumnProps>) {
  return (
    <div className="space-y-8 lg:col-span-3">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Description</h2>
          {isRecordReadOnly ? null : (
            <Button
              variant="secondary"
              size="icon"
              className="cursor-pointer"
              aria-label="Edit description"
              title="Edit description"
              onClick={() => setEditing((prev) => !prev)}
            >
              <PencilIcon />
            </Button>
          )}
        </div>
        {isEditing && !isRecordReadOnly ? (
          <WorkItemDescriptionEditor
            id={workItem.id}
            initialContent={descriptionContent}
            onSave={onDescriptionSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <DescriptionView description={workItem.description} />
          </div>
        )}
      </section>

      {sections.attachments ? (
        <>
          <Separator />
          <AttachmentsSection
            workItemId={workItem.id}
            initialAttachments={[...initialAttachments]}
            uploadOpen={attachmentUploadOpen}
            onUploadOpenChange={setAttachmentUploadOpen}
            readOnly={isRecordReadOnly}
          />
        </>
      ) : null}

      {showSubtasks ? (
        <>
          <Separator />
          <WorkItemSubtasksSection
            items={sortedChildWorkItems}
            childCommentCounts={childCommentCounts}
            childDonePercent={childDonePercent}
            canCreateSubtask={canCreateSubtask}
            readOnly={isRecordReadOnly}
            sortField={subtaskSortField}
            sortDirection={subtaskSortDirection}
            onSortFieldChange={setSubtaskSortField}
            onSortDirectionChange={setSubtaskSortDirection}
            onLinkExisting={onLinkExistingSubtask}
            onUnlink={onUnlinkSubtask}
            isUserOnline={isUserOnline}
          />
        </>
      ) : null}

      {sections.linkedIssues ? (
        <>
          <Separator />
          <WorkItemLinkedIssuesSection
            links={linkedIssues}
            readOnly={isRecordReadOnly}
            onLinkIssue={onLinkIssue}
            onUnlink={onUnlinkIssue}
          />
        </>
      ) : null}

      {sections.discussion ? (
        <>
          <Separator />
          <WorkItemActivityTabs
            activeTab={activityTab}
            onActiveTabChange={setActivityTab}
            initialComments={initialComments}
            activities={activities}
            activityLookups={activityLookups}
            workItem={workItem}
            discussionWorkItems={discussionWorkItems}
            currentUserId={currentUserId}
            workLogs={workLogs}
            onAddWorkLogClick={onAddWorkLogClick}
            readOnly={isRecordReadOnly}
            onlineMembersSlot={onlineMembersSlot}
          />
        </>
      ) : null}
    </div>
  );
}

const EMPTY_CHILD_WORK_ITEMS: DbWorkItem[] = [];
const EMPTY_LINKABLE_WORK_ITEMS: readonly WorkItemChildRef[] = [];
const EMPTY_LINKED_ISSUES: readonly WorkItemLinkListItem[] = [];
const EMPTY_LINKABLE_ISSUES: readonly {
  id: string;
  title: string;
  type: string;
}[] = [];
const EMPTY_ANCESTORS: readonly WorkItemAncestor[] = [];
const EMPTY_COMMENTS: CommentItem[] = [];
const EMPTY_ATTACHMENTS: AttachmentWithUploader[] = [];
const EMPTY_ACTIVITIES: WorkItemActivity[] = [];
const EMPTY_WORK_LOGS: WorkItemWorkLog[] = [];
const EMPTY_PROJECT_MEMBERS: readonly WorkItemPatchMemberOption[] = [];
const EMPTY_PROJECT_SPRINTS: readonly WorkItemSprintOption[] = [];
const EMPTY_DISCUSSION_WORK_ITEMS: CommentWorkItemOption[] = [];
const EMPTY_CHILD_COMMENT_COUNTS: Readonly<Record<string, number>> = {};

export default function WorkItemDetails({
  workItemDetails,
  childWorkItems = EMPTY_CHILD_WORK_ITEMS,
  childCommentCounts = EMPTY_CHILD_COMMENT_COUNTS,
  linkableWorkItems = EMPTY_LINKABLE_WORK_ITEMS,
  initialLinkedIssues = EMPTY_LINKED_ISSUES,
  linkableIssues = EMPTY_LINKABLE_ISSUES,
  ancestors = EMPTY_ANCESTORS,
  project = null,
  initialComments = EMPTY_COMMENTS,
  initialAttachments = EMPTY_ATTACHMENTS,
  initialActivities = EMPTY_ACTIVITIES,
  initialWorkLogs = EMPTY_WORK_LOGS,
  currentUserId,
  currentUserRole,
  projectMembers = EMPTY_PROJECT_MEMBERS,
  projectSprints = EMPTY_PROJECT_SPRINTS,
  discussionWorkItems: discussionWorkItemsProp = EMPTY_DISCUSSION_WORK_ITEMS,
  initialDetailsPreferences = DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
}: Readonly<{
  workItemDetails: DbWorkItem;
  childWorkItems?: DbWorkItem[];
  /** Active comment counts (incl. replies) keyed by child work item id. */
  childCommentCounts?: Readonly<Record<string, number>>;
  linkableWorkItems?: readonly WorkItemChildRef[];
  initialLinkedIssues?: readonly WorkItemLinkListItem[];
  linkableIssues?: readonly { id: string; title: string; type: string }[];
  ancestors?: readonly WorkItemAncestor[];
  project?: DbProject | null;
  initialComments?: CommentItem[];
  initialAttachments?: AttachmentWithUploader[];
  initialActivities?: WorkItemActivity[];
  initialWorkLogs?: WorkItemWorkLog[];
  currentUserId?: string;
  currentUserRole?: string | null;
  projectMembers?: readonly WorkItemPatchMemberOption[];
  projectSprints?: readonly WorkItemSprintOption[];
  discussionWorkItems?: CommentWorkItemOption[];
  initialDetailsPreferences?: WorkItemDetailsPreferences;
}>) {
  const router = useRouter();
  const { isUserOnline } = useRealtime();
  const { handleMutationError } = useOptimisticLock();
  const [workItem, setWorkItem] = useState<DbWorkItem>(workItemDetails);
  const [detailsPreferences, setDetailsPreferences] =
    useState<WorkItemDetailsPreferences>(() =>
      normalizeWorkItemDetailsPreferences(initialDetailsPreferences)
    );
  const lifecycle = useWorkItemLifecycleActions({
    currentUserId,
    onError: (message) => {
      if (!message) {
        return;
      }
      toast.error(message);
    },
    onRestoreSuccess: () => {
      setWorkItem(clearArchivedRecordStatus);
      toast.success('Work item restored');
    },
  });
  const [isEditing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState(false);
  const [linkSubtaskDialogOpen, setLinkSubtaskDialogOpen] = useState(false);
  const [linkIssueDialogOpen, setLinkIssueDialogOpen] = useState(false);
  const [linkedIssues, setLinkedIssues] =
    useState<readonly WorkItemLinkListItem[]>(initialLinkedIssues);
  const [linkCandidatePool, setLinkCandidatePool] = useState(linkableIssues);
  const [subtaskSortField, setSubtaskSortField] =
    useState<SubtaskSortField>('none');
  const [subtaskSortDirection, setSubtaskSortDirection] =
    useState<SubtaskSortDirection>('asc');
  const [unlinkTarget, setUnlinkTarget] = useState<WorkItemChildRef | null>(
    null
  );
  const [unlinkIssueTarget, setUnlinkIssueTarget] =
    useState<LinkedIssueUnlinkTarget | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkItemWorkLog[]>(initialWorkLogs);
  const [activities, setActivities] =
    useState<WorkItemActivity[]>(initialActivities);
  const [activityTab, setActivityTab] =
    useState<WorkItemActivityTab>('discussion');
  const [loggedHoursInput, setLoggedHoursInput] = useState<string>('');
  const [loggedAtInput, setLoggedAtInput] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workLogCommentInput, setWorkLogCommentInput] = useState<string>('');
  const [workLogDialogOpen, setWorkLogDialogOpen] = useState(false);
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  useOptimisticPendingHydrate({
    entityType: 'work_item',
    entityId: workItem.id,
    userId: currentUserId,
    serverUpdatedAt: workItem.updated_at,
  });

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  useEffect(() => {
    setWorkLogs(initialWorkLogs);
  }, [initialWorkLogs]);

  useEffect(() => {
    setLinkedIssues(initialLinkedIssues);
  }, [initialLinkedIssues]);

  useEffect(() => {
    setLinkCandidatePool(linkableIssues);
  }, [linkableIssues]);

  useScopedTableRealtime<ActivityRealtimeRow>({
    enabled: Boolean(workItem.id),
    channelPrefix: 'wi-activities',
    table: 'activities',
    scopeKey: workItem.id,
    filter: `work_item_id=eq.${workItem.id}`,
    onChange: ({ eventType, new: nextRow, old: prevRow }) => {
      setActivities((prev) => {
        const row = rowFromRealtimePayload(eventType, nextRow, prevRow);
        return (
          applyRealtimeActivityChange(prev, eventType, row, projectMembers) ??
          prev
        );
      });
    },
  });

  useScopedTableRealtime<WorkLogRealtimeRow>({
    enabled: Boolean(workItem.id),
    channelPrefix: 'wi-worklogs',
    table: 'work_item_worklogs',
    scopeKey: workItem.id,
    filter: `work_item_id=eq.${workItem.id}`,
    onChange: ({ eventType, new: nextRow, old: prevRow }) => {
      setWorkLogs((prev) => {
        const row = rowFromRealtimePayload(eventType, nextRow, prevRow);
        return (
          applyRealtimeWorkLogChange(prev, eventType, row, projectMembers) ??
          prev
        );
      });
    },
  });

  useEffect(() => {
    setMoreFieldsOpen(readMoreFieldsOpen(currentUserId));
    const stored = readWorkItemDetailsPreferencesLocal(currentUserId);
    if (stored) {
      setDetailsPreferences(stored);
    }
  }, [currentUserId]);

  const handleMoreFieldsOpenChange = (open: boolean) => {
    setMoreFieldsOpen(open);
    writeMoreFieldsOpen(currentUserId, open);
  };

  const handleDetailsPreferencesChange = (next: WorkItemDetailsPreferences) => {
    const normalized = normalizeWorkItemDetailsPreferences(next);
    setDetailsPreferences(normalized);
    writeWorkItemDetailsPreferences(currentUserId, normalized);
  };

  const allowedChildType = getAllowedChildType(workItem.type as WorkItemType);
  const isArchived = workItem.record_status === 'archived';
  const isRecordReadOnly = workItem.status === 'Done' || isArchived;
  const canCreateSubtask = Boolean(
    allowedChildType && project && !isRecordReadOnly
  );

  const handleWorkItemPatched = (updated: Partial<DbWorkItem>) => {
    setWorkItem((prev) => ({ ...prev, ...updated }));
  };

  const descriptionContent = useMemo(
    () => toTiptapContent(workItem.description ?? null),
    [workItem.description]
  );

  useOptimisticPending({
    entityType: 'work_item',
    entityId: workItem.id,
    userId: currentUserId,
    baseUpdatedAt: workItem.updated_at,
    pendingFields: isEditing ? { description: descriptionContent } : {},
    enabled: isEditing,
  });

  const childDonePercent = useMemo(
    () =>
      averageStatusCompletionPercent(
        childWorkItems.map((child) => child.status)
      ),
    [childWorkItems]
  );

  const sortedChildWorkItems = useMemo(
    () => sortSubtasks(childWorkItems, subtaskSortField, subtaskSortDirection),
    [childWorkItems, subtaskSortField, subtaskSortDirection]
  );

  const discussionWorkItems = useMemo(
    () => resolveDiscussionWorkItems(discussionWorkItemsProp, workItem),
    [discussionWorkItemsProp, workItem]
  );

  const activityLookups = useMemo(
    () =>
      buildActivityValueLookups({
        projectMembers,
        projectSprints,
        assignee: workItem.assignee,
        reporter: workItem.reporter,
        sprint: workItem.sprint,
      }),
    [
      projectMembers,
      projectSprints,
      workItem.assignee,
      workItem.reporter,
      workItem.sprint,
    ]
  );

  const handleDescriptionUpdate = async (content: JSONContent) => {
    const descriptionJson = content as Json;
    const formData = new FormData();
    formData.set('description', JSON.stringify(descriptionJson));
    const expectedUpdatedAt = workItem.updated_at;

    try {
      const response = await updateWorkItem(
        workItem.id,
        formData,
        expectedUpdatedAt
      );
      setWorkItem((prev) => ({
        ...prev,
        description: descriptionJson,
        updated_at: response.data?.updated_at ?? prev.updated_at,
      }));
      setEditing(false);
      toast.success('Description saved');
    } catch (error) {
      const locked = await tryHandleLockedMutationError({
        error,
        handleMutationError,
        entityType: 'work_item',
        entityId: workItem.id,
        expectedUpdatedAt,
        pendingFields: { description: descriptionJson },
        currentUserId,
      });
      if (locked) {
        return;
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to save description.'
      );
    }
  };

  const handleWorkLogSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateWorkLogInputs(
      loggedHoursInput,
      loggedAtInput
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoggingWork(true);

    try {
      const created = await createWorkItemWorkLog(workItem.id, {
        loggedHours: Number(loggedHoursInput),
        loggedAt: loggedAtInput,
        comment: workLogCommentInput.trim() ? workLogCommentInput : null,
      });

      setWorkLogs((prev) => [created, ...prev]);
      setLoggedHoursInput('');
      setWorkLogCommentInput('');
      setWorkLogDialogOpen(false);
      toast.success('Work logged');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to log work';
      toast.error(message);
    } finally {
      setIsLoggingWork(false);
    }
  };

  const openWorkLogDialog = () => {
    setWorkLogDialogOpen(true);
  };

  const handleSubtaskCreated = () => {
    setSubtaskDialogOpen(false);
    toast.success('Subtask created');
    router.refresh();
  };

  const handleSubtaskLinked = () => {
    setLinkSubtaskDialogOpen(false);
    router.refresh();
  };

  const handleSubtaskUnlinked = () => {
    setUnlinkTarget(null);
    router.refresh();
  };

  const handleIssueLinked = (link: WorkItemLinkListItem) => {
    setLinkedIssues((prev) => [
      link,
      ...prev.filter((item) => item.id !== link.id),
    ]);
    setLinkIssueDialogOpen(false);
  };

  const handleIssueUnlinked = (linkId: string) => {
    const removed = linkedIssues.find((link) => link.id === linkId);
    setLinkedIssues((prev) => prev.filter((item) => item.id !== linkId));
    if (removed) {
      setLinkCandidatePool((prev) => {
        if (prev.some((item) => item.id === removed.related.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: removed.related.id,
            title: removed.related.title,
            type: removed.related.type,
          },
        ];
      });
    }
    setUnlinkIssueTarget(null);
  };

  const linkedIssueIds = useMemo(
    () => new Set(linkedIssues.map((link) => link.related.id)),
    [linkedIssues]
  );
  const availableLinkableIssues = useMemo(
    () =>
      linkCandidatePool.filter(
        (item) => item.id !== workItem.id && !linkedIssueIds.has(item.id)
      ),
    [linkCandidatePool, linkedIssueIds, workItem.id]
  );

  const assigneeOnline = workItem.assignee_id
    ? isUserOnline(workItem.assignee_id)
    : false;
  const workLogClickHandler = isRecordReadOnly ? undefined : openWorkLogDialog;

  return (
    <div className="space-y-6 pb-12">
      <WorkItemSummaryBanner
        workItem={workItem}
        project={project}
        workflowConfig={project?.workflow_config}
        assigneeOnline={assigneeOnline}
        readOnly={isRecordReadOnly}
        breadcrumb={
          <WorkItemPathBreadcrumb workItem={workItem} ancestors={ancestors} />
        }
        preferences={detailsPreferences}
        onPatched={handleWorkItemPatched}
      />

      <div className="mx-auto w-full max-w-7xl space-y-6">
        {isArchived ? (
          <WorkItemArchivedBanner
            isPending={lifecycle.isPending}
            onRestore={() => lifecycle.handleRestore(workItem)}
          />
        ) : null}

        {lifecycle.itemToConfirm ? (
          <RegistryConfirmDialog
            title={lifecycle.confirmCopy.title}
            subject={lifecycle.itemToConfirm.title}
            detail={lifecycle.confirmCopy.detail}
            confirmLabel={lifecycle.confirmCopy.confirmLabel}
            isPending={lifecycle.isPending}
            isSoft={lifecycle.confirmCopy.isSoft}
            actionVerb={lifecycle.confirmCopy.actionVerb}
            onCancel={lifecycle.clearConfirm}
            onConfirm={lifecycle.confirmLifecycleAction}
          />
        ) : null}

        <WorkItemDetailsActionStrip
          readOnly={isRecordReadOnly}
          canAttach={detailsPreferences.sections.attachments}
          canCreateSubtask={
            canCreateSubtask && detailsPreferences.sections.subtasks
          }
          canLinkIssue={detailsPreferences.sections.linkedIssues}
          onAttach={() => setAttachmentUploadOpen(true)}
          onCreateSubtask={() => setSubtaskDialogOpen(true)}
          onLinkIssue={() => setLinkIssueDialogOpen(true)}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <WorkItemDetailsMainColumn
            workItem={workItem}
            isRecordReadOnly={isRecordReadOnly}
            isEditing={isEditing}
            setEditing={setEditing}
            descriptionContent={descriptionContent}
            onDescriptionSave={handleDescriptionUpdate}
            sections={detailsPreferences.sections}
            initialAttachments={initialAttachments}
            attachmentUploadOpen={attachmentUploadOpen}
            setAttachmentUploadOpen={setAttachmentUploadOpen}
            showSubtasks={Boolean(
              allowedChildType && detailsPreferences.sections.subtasks
            )}
            sortedChildWorkItems={sortedChildWorkItems}
            childCommentCounts={childCommentCounts}
            childDonePercent={childDonePercent}
            canCreateSubtask={canCreateSubtask}
            subtaskSortField={subtaskSortField}
            subtaskSortDirection={subtaskSortDirection}
            setSubtaskSortField={setSubtaskSortField}
            setSubtaskSortDirection={setSubtaskSortDirection}
            onLinkExistingSubtask={() => setLinkSubtaskDialogOpen(true)}
            onUnlinkSubtask={setUnlinkTarget}
            linkedIssues={linkedIssues}
            onLinkIssue={() => setLinkIssueDialogOpen(true)}
            onUnlinkIssue={setUnlinkIssueTarget}
            isUserOnline={isUserOnline}
            activityTab={activityTab}
            setActivityTab={setActivityTab}
            initialComments={initialComments}
            activities={activities}
            activityLookups={activityLookups}
            discussionWorkItems={discussionWorkItems}
            currentUserId={currentUserId}
            workLogs={workLogs}
            onAddWorkLogClick={workLogClickHandler}
            onlineMembersSlot={
              <OnlineMembersAvatarGroup
                members={projectMembers.map((member) => ({
                  id: member.id,
                  name: member.name,
                  profilePicture: member.profile_picture,
                }))}
                currentUserId={currentUserId}
                isUserOnline={isUserOnline}
              />
            }
          />

          {/* Sidebar */}
          <WorkItemSidebar
            workItem={workItem}
            childStatuses={childWorkItems.map((child) => child.status)}
            projectMembers={projectMembers}
            projectSprints={projectSprints}
            project={project}
            workLogs={workLogs}
            detailsOpen={detailsOpen}
            setDetailsOpen={setDetailsOpen}
            moreFieldsOpen={moreFieldsOpen}
            setMoreFieldsOpen={handleMoreFieldsOpenChange}
            preferences={detailsPreferences}
            onPreferencesChange={handleDetailsPreferencesChange}
            onWorkItemPatched={handleWorkItemPatched}
            onLogWorkClick={workLogClickHandler}
            readOnly={isRecordReadOnly}
            currentUserRole={currentUserRole}
          />
        </div>

        {workLogClickHandler ? (
          <WorkItemWorkLogDialog
            open={workLogDialogOpen}
            onOpenChange={setWorkLogDialogOpen}
            loggedHoursInput={loggedHoursInput}
            loggedAtInput={loggedAtInput}
            workLogCommentInput={workLogCommentInput}
            isLoggingWork={isLoggingWork}
            onLoggedHoursChange={setLoggedHoursInput}
            onLoggedAtChange={setLoggedAtInput}
            onWorkLogCommentChange={setWorkLogCommentInput}
            onSubmit={handleWorkLogSubmit}
          />
        ) : null}

        {canCreateSubtask && allowedChildType && project ? (
          <>
            <WorkItemFormDialog
              open={subtaskDialogOpen}
              onOpenChange={setSubtaskDialogOpen}
              title="Create Subtask"
              description={`Create a ${allowedChildType} under this ${workItem.type}.`}
              projects={[project]}
              projectMembers={projectMembers}
              parentId={workItem.id}
              defaultSprintId={workItem.sprint_id}
              allowedTypes={[allowedChildType]}
              lockProject
              lockType
              lockParent
              onClose={() => setSubtaskDialogOpen(false)}
              onSuccess={handleSubtaskCreated}
            />
            <WorkItemLinkSubtaskDialog
              open={linkSubtaskDialogOpen}
              onOpenChange={setLinkSubtaskDialogOpen}
              parentWorkItemId={workItem.id}
              parentType={workItem.type as WorkItemType}
              childType={allowedChildType}
              candidates={linkableWorkItems}
              onLinked={handleSubtaskLinked}
            />
          </>
        ) : null}

        {unlinkTarget ? (
          <WorkItemUnlinkSubtaskDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setUnlinkTarget(null);
              }
            }}
            childId={unlinkTarget.id}
            childTitle={unlinkTarget.title}
            childType={unlinkTarget.type as WorkItemType}
            childUpdatedAt={unlinkTarget.updated_at}
            parentType={workItem.type as WorkItemType}
            onUnlinked={handleSubtaskUnlinked}
          />
        ) : null}

        {detailsPreferences.sections.linkedIssues ? (
          <WorkItemLinkIssueDialog
            open={linkIssueDialogOpen}
            onOpenChange={setLinkIssueDialogOpen}
            workItemId={workItem.id}
            candidates={availableLinkableIssues}
            onLinked={handleIssueLinked}
          />
        ) : null}

        {unlinkIssueTarget ? (
          <WorkItemUnlinkIssueDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setUnlinkIssueTarget(null);
              }
            }}
            workItemId={workItem.id}
            linkId={unlinkIssueTarget.linkId}
            relatedTitle={unlinkIssueTarget.relatedTitle}
            onUnlinked={handleIssueUnlinked}
          />
        ) : null}
      </div>
    </div>
  );
}
