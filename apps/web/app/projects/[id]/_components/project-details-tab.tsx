'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Calendar, Folder, Shield } from '@repo/ui/lib/icons';
import { ProjectSummaryMetrics } from '@/app/projects/[id]/_components/project-summary-metrics';
import { REPORT_CARD_CLASS } from '@/app/projects/[id]/_components/project-details-shared';
import type { Project } from '../../_services/projects.service';
import { formatDate } from '@/app/_shared/utility';

export type ProjectDetailsTabProps = {
  readonly project: Project;
  readonly memberCount: number;
  readonly teamCount: number;
  readonly workItemCount: number;
};

export function ProjectDetailsTab({
  project,
  memberCount,
  teamCount,
  workItemCount,
}: Readonly<ProjectDetailsTabProps>) {
  return (
    <div className="space-y-6">
      <ProjectSummaryMetrics
        memberCount={memberCount}
        teamCount={teamCount}
        workItemCount={workItemCount}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className={`${REPORT_CARD_CLASS} md:col-span-2`}>
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
              <Folder className="h-5 w-5" />
              Project Information
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Primary metadata and structural configuration of the project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Project Name
                </span>
                <p className="text-foreground text-sm font-semibold">
                  {project.name}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Unique Key
                </span>
                <p className="text-foreground font-mono text-sm font-semibold">
                  {project.key}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Description
              </span>
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {project.description ||
                  'No description configured for this project.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Timeline Calendar
                </span>
                <p className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                  <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                  {project.start_date || project.end_date ? (
                    <>
                      {project.start_date
                        ? formatDate(project.start_date)
                        : 'Start Date'}
                      {' — '}
                      {project.end_date
                        ? formatDate(project.end_date)
                        : 'End Date'}
                    </>
                  ) : (
                    'No timeline configured'
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground mr-4 text-xs font-semibold tracking-wider uppercase">
                  Record Status
                </span>
                <Badge
                  variant="outline"
                  className={
                    project.status === 'active'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }
                >
                  {project.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`${REPORT_CARD_CLASS} h-fit`}>
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
              <Shield className="h-5 w-5" />
              Ownership
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Project owner and administrator configurations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-primary/5 border-primary/10 flex items-start gap-3 rounded-lg border p-3">
              <div className="bg-primary/20 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {(project.owner?.name ?? 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <TruncatedText className="text-foreground text-sm font-semibold">
                  {project.owner?.name ?? 'Unknown Owner'}
                </TruncatedText>
                <TruncatedText className="text-muted-foreground text-xs">
                  {project.owner?.email ?? 'No email configured'}
                </TruncatedText>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
