import Link from 'next/link';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/ui/components/ui/breadcrumb';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import type {
  DbWorkItem,
  WorkItemAncestor,
} from '@/app/work-items/_services/work-items.reads.server';
import type { WorkItemType } from '@repo/types';

type WorkItemPathBreadcrumbProps = {
  readonly workItem: Pick<
    DbWorkItem,
    'id' | 'type' | 'title' | 'sprint_id' | 'project' | 'sprint'
  >;
  /** Hierarchy ancestors root-first (Epic → … → immediate parent). */
  readonly ancestors?: readonly WorkItemAncestor[];
};

function PathTypeChip({
  type,
  title,
}: Readonly<{ type: WorkItemType; title: string }>) {
  const label = title.trim() || 'Untitled';
  return (
    <span className="flex min-w-0 items-center gap-2">
      <WorkItemTypeBadge type={type} className="shrink-0 font-normal" />
      <TruncatedText as="span" className="max-w-28 text-xs sm:max-w-40">
        {label}
      </TruncatedText>
    </span>
  );
}

/**
 * In-page path above the title:
 * `PROJECT_KEY > Sprint name > [Epic] … > [Type] Title`
 * Unassigned sprint renders an ellipsis segment.
 * Ancestors (when present) link to parent work-item details.
 */
export function WorkItemPathBreadcrumb({
  workItem,
  ancestors = [],
}: Readonly<WorkItemPathBreadcrumbProps>) {
  const projectKey = workItem.project?.key?.trim() || '—';
  const projectId = workItem.project?.id;
  const sprintName = workItem.sprint?.name?.trim() ?? null;
  const hasSprint = Boolean(workItem.sprint_id && sprintName);

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1.5 text-xs sm:gap-2">
        <BreadcrumbItem>
          {projectId ? (
            <BreadcrumbLink
              asChild
              className="text-muted-foreground hover:text-primary font-mono tracking-wide uppercase"
            >
              <Link href={`/projects/${projectId}`}>{projectKey}</Link>
            </BreadcrumbLink>
          ) : (
            <span className="text-muted-foreground font-mono tracking-wide uppercase">
              {projectKey}
            </span>
          )}
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          {hasSprint ? (
            <TruncatedText
              as="span"
              className="text-muted-foreground max-w-40 text-xs sm:max-w-56"
            >
              {sprintName!}
            </TruncatedText>
          ) : (
            <BreadcrumbEllipsis className="text-muted-foreground size-4" />
          )}
        </BreadcrumbItem>

        {ancestors.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbLink asChild className="hover:text-primary min-w-0">
                <Link href={`/work-items/${ancestor.id}`} className="min-w-0">
                  <PathTypeChip type={ancestor.type} title={ancestor.title} />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}

        <BreadcrumbSeparator />

        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="min-w-0">
            <PathTypeChip type={workItem.type} title={workItem.title} />
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
