'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { getInitials } from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type {
  AttachmentWithUploader,
  Json,
  WorkItemWorkLog,
} from '@repo/types';
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
  MoreHorizontal,
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
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/workItem-field-patch-dialog';
import { toast } from '@repo/ui/components/ui/sonner';
import { CommentItem } from '@/app/comments/_services/comments.service';

const PLACEHOLDER_CHILD_ISSUES = [
  {
    id: 'c1',
    key: 'ISSUE-101',
    title: 'Define API contract for helper microservice',
    comments: 4,
    status: 'ToDo' as const,
  },
  {
    id: 'c2',
    key: 'ISSUE-102',
    title: 'Add authentication middleware',
    comments: 2,
    status: 'InProgress' as const,
  },
  {
    id: 'c3',
    key: 'ISSUE-103',
    title: 'Write integration tests',
    comments: 1,
    status: 'New' as const,
  },
] as const;

export default function WorkItemDetails({
  workItemDetails,
  initialComments = [],
  initialAttachments = [],
  initialWorkLogs = [],
  currentUserId,
  projectMembers = [],
}: Readonly<{
  workItemDetails: DbWorkItem;
  initialComments?: CommentItem[];
  initialAttachments?: AttachmentWithUploader[];
  initialWorkLogs?: WorkItemWorkLog[];
  currentUserId?: string;
  projectMembers?: readonly WorkItemPatchMemberOption[];
}>) {
  const [workItem, setWorkItem] = useState<DbWorkItem>(workItemDetails);
  const [isEditing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [workLogs, setWorkLogs] = useState<WorkItemWorkLog[]>(initialWorkLogs);
  const [activityTab, setActivityTab] =
    useState<WorkItemActivityTab>('discussion');
  const [loggedHoursInput, setLoggedHoursInput] = useState<string>('');
  const [loggedAtInput, setLoggedAtInput] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workLogCommentInput, setWorkLogCommentInput] = useState<string>('');
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  const handleWorkItemPatched = (updated: Partial<DbWorkItem>) => {
    setWorkItem((prev) => ({ ...prev, ...updated }));
  };

  const descriptionContent = useMemo(
    () => toTiptapContent(workItem.description),
    [workItem.description]
  );

  const childDonePercent = 0;

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Title + actions — same 3∶2 column ratio as the body so the
          title pencil lines up above the description pencil. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="min-w-0 space-y-1">
            <WorkItemPathBreadcrumb workItem={workItem} />
            <WorkItemTitleEditor
              workItemId={workItem.id}
              title={workItem.title}
              onPatched={handleWorkItemPatched}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={() => setAttachmentUploadOpen(true)}
            >
              <Paperclip data-icon="inline-start" />
              Attach
            </Button>
            <Button variant="ghost" size="sm" className="cursor-pointer">
              <Plus data-icon="inline-start" />
              Create subtask
            </Button>
            <Button variant="ghost" size="sm" className="cursor-pointer">
              <Link2 data-icon="inline-start" />
              Link issue
              <ChevronDown data-icon="inline-end" />
            </Button>
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
              <Button
                variant="secondary"
                size="icon"
                className="cursor-pointer"
                onClick={() => setEditing((prev) => !prev)}
              >
                <PencilIcon />
              </Button>
            </div>
            {isEditing ? (
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
          />

          <Separator />

          {/* Child issues */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Child issues</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="cursor-pointer">
                  Order by
                  <ChevronDown data-icon="inline-end" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="More child issue actions"
                >
                  <MoreHorizontal />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Add child issue"
                >
                  <Plus />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Progress value={childDonePercent} className="h-1.5 flex-1" />
              <span className="text-muted-foreground shrink-0 text-xs">
                {childDonePercent}% Done
              </span>
            </div>

            <div className="rounded-lg border">
              <Table className="min-w-xl table-fixed">
                <colgroup>
                  <col className="w-28" />
                  <col />
                  <col className="w-12" />
                  <col className="w-24" />
                  <col className="w-10" />
                  <col className="w-28" />
                </colgroup>
                <TableBody>
                  {PLACEHOLDER_CHILD_ISSUES.map((child) => (
                    <TableRow
                      key={child.id}
                      className="hover:bg-muted/40 border-border"
                    >
                      <TableCell className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {child.key}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-0 px-2 py-2.5 whitespace-normal">
                        <TruncatedText className="text-sm">
                          {child.title}
                        </TruncatedText>
                      </TableCell>
                      <TableCell className="px-2 py-2.5">
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <MessageSquare className="size-3.5 shrink-0" />
                          {child.comments}
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-2.5">
                        <PriorityBadge priority={workItem.priority} />
                      </TableCell>
                      <TableCell className="px-2 py-2.5">
                        <Avatar size="sm">
                          <AvatarFallback>
                            {getInitials(workItem.assignee?.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <WorkItemStatusBadge status={child.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator />

          {/* Linked issues */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Linked issues</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="Link issue"
              >
                <Plus />
              </Button>
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
          />
        </div>

        {/* Sidebar */}
        <WorkItemSidebar
          workItem={workItem}
          projectMembers={projectMembers}
          workLogs={workLogs}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          moreFieldsOpen={moreFieldsOpen}
          setMoreFieldsOpen={setMoreFieldsOpen}
          onWorkItemPatched={handleWorkItemPatched}
          onLogWorkClick={() => setActivityTab('work-log')}
        />
      </div>
    </div>
  );
}
