'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import {
  getAllowedChildType,
  type WorkItemType,
  type AttachmentWithUploader,
  type Json,
  type WorkItemWorkLog,
} from '@repo/types';
import { getInitials } from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form-dialog';
import { WorkItemLinkSubtaskDialog } from '@/app/work-items/_components/work-item-link-subtask-dialog';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { AttachmentsSection } from '@/app/work-items/_components/work-item-attachments-section';
import {
  WorkItemActivityTabs,
  type WorkItemActivityTab,
} from '@/app/work-items/_components/work-item-activity-tabs';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
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
  ChevronDown,
  Link2,
  MessageSquare,
  Paperclip,
  PencilIcon,
  Plus,
} from '@repo/ui/lib/icons';
import WorkItemDescriptionEditor from '@/app/work-items/_components/workItem-description-editor';
import { DescriptionView } from '@/app/work-items/_components/workItem-description-view';
import { toTiptapContent } from '@/app/work-items/_helpers/work-item-description';
import {
  createWorkItemWorkLog,
  updateWorkItem,
} from '@/app/work-items/_services/workItem.service.client';
import WorkItemSidebar from '@/app/work-items/_components/workItem-details-sidebar';
import { WorkItemTitleEditor } from '@/app/work-items/_components/workItem-title-editor';
import { WorkItemPathBreadcrumb } from '@/app/work-items/_components/work-item-path-breadcrumb';
import { SubtaskOrderByMenu } from '@/app/work-items/_components/subtask-order-by-menu';
import {
  UnlinkSubtaskButton,
  WorkItemUnlinkSubtaskDialog,
} from '@/app/work-items/_components/work-item-unlink-subtask-dialog';
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/workItem-field-patch-dialog';
import { averageStatusCompletionPercent } from '@/app/work-items/_helpers/work-item-status';
import {
  sortSubtasks,
  type SubtaskSortDirection,
  type SubtaskSortField,
} from '@/app/work-items/_helpers/sort-subtasks';
import { toast } from '@repo/ui/components/ui/sonner';
import { CommentItem } from '@/app/comments/_services/comments.service';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { WorkItemAncestor } from '@/app/work-items/_services/workItem.service.server';

function childWorkItemKey(child: DbWorkItem): string {
  return child.jira_issue_key?.trim() || child.id.slice(0, 8).toUpperCase();
}

export default function WorkItemDetails({
  workItemDetails,
  childWorkItems = [],
  childCommentCounts = {},
  linkableWorkItems = [],
  ancestors = [],
  project = null,
  initialComments = [],
  initialAttachments = [],
  initialWorkLogs = [],
  currentUserId,
  projectMembers = [],
}: Readonly<{
  workItemDetails: DbWorkItem;
  childWorkItems?: DbWorkItem[];
  /** Active comment counts (incl. replies) keyed by child work item id. */
  childCommentCounts?: Readonly<Record<string, number>>;
  linkableWorkItems?: readonly Pick<DbWorkItem, 'id' | 'title' | 'type'>[];
  ancestors?: readonly WorkItemAncestor[];
  project?: DbProject | null;
  initialComments?: CommentItem[];
  initialAttachments?: AttachmentWithUploader[];
  initialWorkLogs?: WorkItemWorkLog[];
  currentUserId?: string;
  projectMembers?: readonly WorkItemPatchMemberOption[];
}>) {
  const router = useRouter();
  const [workItem, setWorkItem] = useState<DbWorkItem>(workItemDetails);
  const [isEditing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState(false);
  const [linkSubtaskDialogOpen, setLinkSubtaskDialogOpen] = useState(false);
  const [subtaskSortField, setSubtaskSortField] =
    useState<SubtaskSortField>('none');
  const [subtaskSortDirection, setSubtaskSortDirection] =
    useState<SubtaskSortDirection>('asc');
  const [unlinkTarget, setUnlinkTarget] = useState<Pick<
    DbWorkItem,
    'id' | 'title' | 'type'
  > | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkItemWorkLog[]>(initialWorkLogs);
  const [activityTab, setActivityTab] =
    useState<WorkItemActivityTab>('discussion');
  const [loggedHoursInput, setLoggedHoursInput] = useState<string>('');
  const [loggedAtInput, setLoggedAtInput] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workLogCommentInput, setWorkLogCommentInput] = useState<string>('');
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  const allowedChildType = getAllowedChildType(workItem.type as WorkItemType);
  const isRecordReadOnly = workItem.status === 'Done';
  const canCreateSubtask = Boolean(
    allowedChildType && project && !isRecordReadOnly
  );

  const handleWorkItemPatched = (updated: Partial<DbWorkItem>) => {
    setWorkItem((prev) => ({ ...prev, ...updated }));
  };

  const descriptionContent = useMemo(
    () => toTiptapContent(workItem.description),
    [workItem.description]
  );

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
    () => [
      {
        id: workItem.id,
        title: workItem.title,
        key: workItem.id.slice(0, 8).toUpperCase(),
        type: workItem.type,
        project_id: workItem.project_id || '',
      },
    ],
    [workItem.id, workItem.title, workItem.type, workItem.project_id]
  );

  const handleDescriptionUpdate = async (content: Json) => {
    const formData = new FormData();
    formData.set('description', JSON.stringify(content));

    await updateWorkItem(workItem.id, formData);

    setWorkItem((prev) => ({ ...prev, description: content }));
    setEditing(false);
    toast.success('Description saved');
  };

  const handleWorkLogSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextHours = Number(loggedHoursInput);
    if (!Number.isFinite(nextHours) || nextHours <= 0) {
      toast.error('Enter a valid amount of hours.');
      return;
    }

    if (!loggedAtInput) {
      toast.error('Please provide a date for the work log.');
      return;
    }

    setIsLoggingWork(true);

    try {
      const created = await createWorkItemWorkLog(workItem.id, {
        loggedHours: nextHours,
        loggedAt: loggedAtInput,
        comment: workLogCommentInput.trim() ? workLogCommentInput : null,
      });

      setWorkLogs((prev) => [created, ...prev]);
      setLoggedHoursInput('');
      setWorkLogCommentInput('');
      toast.success('Work logged');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to log work';
      toast.error(message);
    } finally {
      setIsLoggingWork(false);
    }
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Title + actions — same 3∶2 column ratio as the body so the
          title pencil lines up above the description pencil. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="min-w-0 space-y-1">
            <WorkItemPathBreadcrumb workItem={workItem} ancestors={ancestors} />
            <WorkItemTitleEditor
              workItemId={workItem.id}
              title={workItem.title}
              onPatched={handleWorkItemPatched}
              readOnly={isRecordReadOnly}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {isRecordReadOnly ? null : (
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => setAttachmentUploadOpen(true)}
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
                onClick={() => setSubtaskDialogOpen(true)}
              >
                <Plus data-icon="inline-start" />
                Create subtask
              </Button>
            ) : null}
            {isRecordReadOnly ? null : (
              <Button variant="ghost" size="sm" className="cursor-pointer">
                <Link2 data-icon="inline-start" />
                Link issue
                <ChevronDown data-icon="inline-end" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Main column */}
        <div className="space-y-8 lg:col-span-3">
          {/* Description */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Description</h2>
              {isRecordReadOnly ? null : (
                <Button
                  variant="secondary"
                  size="icon"
                  className="cursor-pointer"
                  aria-label="Edit description"
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
                onSave={handleDescriptionUpdate}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <DescriptionView description={workItem.description} />
              </div>
            )}
          </section>

          <Separator />

          <AttachmentsSection
            workItemId={workItem.id}
            initialAttachments={initialAttachments}
            uploadOpen={attachmentUploadOpen}
            onUploadOpenChange={setAttachmentUploadOpen}
            readOnly={isRecordReadOnly}
          />

          <Separator />

          {/* Subtasks */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Subtasks</h2>
              <div className="flex items-center gap-1">
                <SubtaskOrderByMenu
                  sortField={subtaskSortField}
                  sortDirection={subtaskSortDirection}
                  onSortFieldChange={setSubtaskSortField}
                  onSortDirectionChange={setSubtaskSortDirection}
                />
                {canCreateSubtask ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    aria-label="Link existing subtask"
                    onClick={() => setLinkSubtaskDialogOpen(true)}
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

            {sortedChildWorkItems.length === 0 ? (
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
                    {sortedChildWorkItems.map((child) => (
                      <TableRow
                        key={child.id}
                        className="hover:bg-muted/40 border-border"
                      >
                        <TableCell className="px-3 py-2.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {childWorkItemKey(child)}
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
                          <Avatar
                            size="sm"
                            title={child.assignee?.name ?? 'Unassigned'}
                          >
                            <AvatarFallback>
                              {getInitials(child.assignee?.name)}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <WorkItemStatusBadge status={child.status} />
                        </TableCell>
                        <TableCell className="px-1 py-2.5">
                          {isRecordReadOnly ? null : (
                            <UnlinkSubtaskButton
                              onClick={() =>
                                setUnlinkTarget({
                                  id: child.id,
                                  title: child.title,
                                  type: child.type,
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

          <Separator />

          {/* Linked issues */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Linked issues</h2>
              {isRecordReadOnly ? null : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Link issue"
                >
                  <Plus />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-sm">is blocked by</p>
            <div
              className={cn(
                'text-muted-foreground flex h-16 items-center justify-center rounded-lg border border-dashed text-sm'
              )}
            >
              No linked issues yet
            </div>
          </section>

          <Separator />

          <WorkItemActivityTabs
            activeTab={activityTab}
            onActiveTabChange={setActivityTab}
            initialComments={initialComments}
            workItem={workItem}
            discussionWorkItems={discussionWorkItems}
            currentUserId={currentUserId}
            workLogs={workLogs}
            loggedHoursInput={loggedHoursInput}
            loggedAtInput={loggedAtInput}
            workLogCommentInput={workLogCommentInput}
            isLoggingWork={isLoggingWork}
            onLoggedHoursChange={setLoggedHoursInput}
            onLoggedAtChange={setLoggedAtInput}
            onWorkLogCommentChange={setWorkLogCommentInput}
            onWorkLogSubmit={handleWorkLogSubmit}
            readOnly={isRecordReadOnly}
          />
        </div>

        {/* Sidebar */}
        <WorkItemSidebar
          workItem={workItem}
          childStatuses={childWorkItems.map((child) => child.status)}
          projectMembers={projectMembers}
          workLogs={workLogs}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          moreFieldsOpen={moreFieldsOpen}
          setMoreFieldsOpen={setMoreFieldsOpen}
          onWorkItemPatched={handleWorkItemPatched}
          onLogWorkClick={() => setActivityTab('work-log')}
          readOnly={isRecordReadOnly}
        />
      </div>

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
            allowedTypes={[allowedChildType]}
            lockProject
            lockType
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
          parentType={workItem.type as WorkItemType}
          onUnlinked={handleSubtaskUnlinked}
        />
      ) : null}
    </div>
  );
}
