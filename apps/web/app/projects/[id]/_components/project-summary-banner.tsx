import { Badge } from '@repo/ui/components/ui/badge';
import { Calendar, CheckCircle, AlertCircle } from '@repo/ui/lib/icons';
import { formatDate } from '@/app/_shared/utility';
import type { Project } from '../../_services/projects.service';

type ProjectSummaryBannerProps = {
  readonly project: Project;
};

export function ProjectSummaryBanner({ project }: ProjectSummaryBannerProps) {
  const isActive = project.status === 'active';
  const hasTimeline = Boolean(project.start_date || project.end_date);

  return (
    <div className="border-primary/15 from-primary/5 relative overflow-hidden rounded-2xl border bg-linear-to-r via-transparent to-transparent px-6 py-4 md:px-8 md:py-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5 fill-current" />
              Active
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400"
            >
              <AlertCircle className="mr-1 h-3.5 w-3.5 fill-current" />
              {project.status}
            </Badge>
          )}
          <span className="bg-primary/10 text-primary border-primary/20 inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
            {project.key}
          </span>
        </div>

        <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          {project.name}
        </h1>

        {hasTimeline ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(project.start_date)} –{' '}
                {formatDate(project.end_date)}
              </span>
            </div>
          </div>
        ) : null}

        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          {project.description || 'No description provided for this project.'}
        </p>
      </div>
    </div>
  );
}
