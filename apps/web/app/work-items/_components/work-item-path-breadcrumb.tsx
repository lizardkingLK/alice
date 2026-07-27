import Link from 'next/link';
import { Badge } from '@repo/ui/components/ui/badge';
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
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

type WorkItemPathBreadcrumbProps = {
  readonly workItem: Pick<
    DbWorkItem,
    'id' | 'type' | 'sprint_id' | 'project' | 'sprint'
  >;
};

/**
 * In-page path above the title:
 * `PROJECT_KEY > Sprint name > [Type] SHORT_ID`
 * Unassigned sprint renders an ellipsis segment.
 */
export function WorkItemPathBreadcrumb({
  workItem,
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

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {workItem.type}
            </Badge>
            <span className="text-muted-foreground font-mono text-xs">
              {toShortId(workItem.id)}
            </span>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
