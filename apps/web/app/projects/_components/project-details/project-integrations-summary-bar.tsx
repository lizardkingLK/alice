'use client';

import { useEffect, useState } from 'react';
import type { ProjectIntegrationsSummary } from '@repo/types/api/v1';
import { Badge } from '@repo/ui/components/ui/badge';
import { getProjectIntegrationsSummary } from '@/app/projects/_services/projects.integrations-summary.client';

export type ProjectIntegrationsSummaryBarProps = {
  readonly projectId: string;
};

function statusLabel(connected: boolean, detail: string | null): string {
  if (!connected) {
    return 'Not linked';
  }
  return detail?.trim() || 'Linked';
}

function providerStatusBadge(
  groupLabel: string,
  providerLabel: string | null,
  connected: boolean,
  detail: string | null
) {
  const status = providerLabel
    ? `${providerLabel} · ${statusLabel(connected, detail)}`
    : statusLabel(connected, null);
  return (
    <Badge variant="outline">
      {groupLabel}:{` ${status}`}
    </Badge>
  );
}

export function ProjectIntegrationsSummaryBar({
  projectId,
}: Readonly<ProjectIntegrationsSummaryBarProps>) {
  const [summary, setSummary] = useState<ProjectIntegrationsSummary | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    getProjectIntegrationsSummary(projectId)
      .then((next) => {
        if (!cancelled) {
          setSummary(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!summary) {
    return null;
  }

  return (
    <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
      <span className="text-muted-foreground font-medium tracking-wide uppercase">
        Project integrations
      </span>
      {providerStatusBadge(
        'Source control',
        summary.source_control.provider ? 'GitHub' : null,
        summary.source_control.connected,
        summary.source_control.repo
      )}
      {providerStatusBadge(
        'Project management',
        summary.project_management.provider ? 'Jira' : null,
        summary.project_management.connected,
        summary.project_management.project_key
      )}
      <Badge variant="outline">
        AI agents: {summary.ai_agents.binding_count} bound
      </Badge>
    </div>
  );
}
