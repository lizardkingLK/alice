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
import { toShortId } from '@/app/_shared/utility';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import type {
  DbWorkItem,
  WorkItemAncestor,
} from '@/app/work-items/_services/work-items.reads.server';
import type { WorkItemType } from '@repo/types';

type WorkItemPathBreadcrumbProps = {
  readonly workItem: Pick<
    DbWorkItem,
    'id' | 'type' | 'sprint_id' | 'project' | 'sprint'
  >;
  /** Hierarchy ancestors root-first (Epic → … → immediate parent). */
  readonly ancestors?: readonly WorkItemAncestor[];
};

function PathTypeChip({
  type,
  id,
}: Readonly<{ type: WorkItemType; id: string }>) {
  return (
    <span className="flex items-center gap-2">
      <WorkItemTypeBadge type={type} className="font-normal" />
      <span className="text-muted-foreground font-mono text-xs">
        {toShortId(id)}
      </span>
    </span>
  );
}

/**
 * In-page path above the title:
 * `PROJECT_KEY > Sprint name > [Epic] … > [Type] SHORT_ID`
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
            <TruncatedText className="text-muted-foreground max-w-40 text-xs sm:max-w-56">
              {sprintName!}
            </TruncatedText>
          ) : (
            <BreadcrumbEllipsis className="text-muted-foreground size-4" />
          )}
        </BreadcrumbItem>

        {ancestors.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="hover:text-primary">
                <Link
                  href={`/work-items/${ancestor.id}`}
                  title={ancestor.title}
                >
                  <PathTypeChip type={ancestor.type} id={ancestor.id} />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbPage>
            <PathTypeChip type={workItem.type} id={workItem.id} />
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
