'use client';

import { useMemo, useState } from 'react';
import { getInitials } from '@/app/_shared/utility';
import { PriorityBadge } from '@/app/work-items/_components/workItem-badge-priority';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
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
  FileImage,
  FileText,
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
import { Json } from '@repo/types';
import { updateWorkItem } from '@/app/work-items/_services/workItem.client.service';
import WorkItemSidebar from '@/app/work-items/_components/workItem-details-sidebar';
import { WorkItemTitleEditor } from '@/app/work-items/_components/workItem-title-editor';
import { toast } from '@repo/ui/components/ui/sonner';

const PLACEHOLDER_ATTACHMENTS = [
  {
    id: '1',
    name: 'Requirements.pdf',
    meta: '10 Apr 2020 10:01 pm',
    kind: 'pdf' as const,
  },
  {
    id: '2',
    name: 'wireframe-hero.png',
    meta: '10 Apr 2020 10:01 pm',
    kind: 'image' as const,
  },
  {
    id: '3',
    name: 'Spec-notes.docx',
    meta: '9 Apr 2020 4:22 pm',
    kind: 'doc' as const,
  },
  {
    id: '4',
    name: 'flow-diagram.png',
    meta: '8 Apr 2020 11:15 am',
    kind: 'image' as const,
  },
] as const;

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

function AttachmentCard({
  name,
  meta,
  kind,
}: Readonly<{
  name: string;
  meta: string;
  kind: 'pdf' | 'image' | 'doc';
}>) {
  return (
    <Card
      className={cn(
        'border-border bg-card min-w-42 shrink-0 overflow-hidden py-0 shadow-none'
      )}
    >
      <div
        className={cn(
          'bg-muted flex h-24 items-center justify-center border-b'
        )}
      >
        {kind === 'image' ? (
          <FileImage className="text-muted-foreground size-8" />
        ) : (
          <FileText className="text-muted-foreground size-8" />
        )}
      </div>
      <CardContent className="space-y-0.5 px-3 py-2.5">
        <TruncatedText className="text-sm font-medium">{name}</TruncatedText>
        <p className="text-muted-foreground text-xs">{meta}</p>
      </CardContent>
    </Card>
  );
}

export default function WorkItemDetails({
  workItemDetails,
}: Readonly<{ workItemDetails: DbWorkItem }>) {
  const [workItem, setWorkItem] = useState<DbWorkItem>(workItemDetails);
  const [isEditing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);

  const descriptionContent = useMemo(
    () => toTiptapContent(workItem.description),
    [workItem.description]
  );

  const childDonePercent = 0;

  const handleDescriptionUpdate = async (content: Json) => {
    const formData = new FormData();
    formData.set('description', JSON.stringify(content));

    await updateWorkItem(workItem.id, formData);

    setWorkItem((prev) => ({ ...prev, description: content }));
    setEditing(false);
    toast.success('Description saved');
  };

  const handleTitleUpdate = async (nextTitle: string) => {
    const formData = new FormData();
    formData.set('title', nextTitle);

    await updateWorkItem(workItem.id, formData);
    setWorkItem((prev) => ({ ...prev, title: nextTitle }));
    toast.success('Title saved');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Title + actions */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{workItem.type}</Badge>
              <span className="text-muted-foreground font-mono text-xs">
                {workItem.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <WorkItemTitleEditor
              title={workItem.title}
              onSave={handleTitleUpdate}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" className="cursor-pointer">
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
                id={WorkItemDescriptionEditor.name}
                initialContent={descriptionContent}
                onSave={handleDescriptionUpdate}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <DescriptionView description={workItem.description} />
            )}
          </section>

          <Separator />

          {/* Attachments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                Attachments{' '}
                <span className="text-muted-foreground font-normal">
                  ({PLACEHOLDER_ATTACHMENTS.length})
                </span>
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Add attachment"
                >
                  <Plus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="More attachment actions"
                >
                  <MoreHorizontal />
                </Button>
              </div>
            </div>

            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {PLACEHOLDER_ATTACHMENTS.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  name={attachment.name}
                  meta={attachment.meta}
                  kind={attachment.kind}
                />
              ))}
            </div>
          </section>

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
        </div>

        {/* Sidebar */}
        <WorkItemSidebar
          workItem={workItem}
          detailsOpen={detailsOpen}
          setDetailsOpen={setDetailsOpen}
          moreFieldsOpen={moreFieldsOpen}
          setMoreFieldsOpen={setMoreFieldsOpen}
        />
      </div>
    </div>
  );
}
