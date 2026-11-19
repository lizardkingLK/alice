'use client';

import { useEffect, useRef } from 'react';
import {
  catalogRevisionFromDefs,
  mergeWitCatalogProjects,
  type WitCatalogProjectEntry,
} from '@/app/work-items/_helpers/wit-catalog-storage';
import { normalizeProjectWorkItemTypeDefs } from '@repo/types';

export type WitCatalogBootstrapProject = {
  readonly id: string;
  readonly workflow_config?: unknown;
  readonly updated_at?: string | null;
};

/**
 * Hydrates the local type catalog from accessible projects after login/session.
 * localStorage is a mirror only — never the write authority.
 */
export function useWitCatalogBootstrap(
  userId: string | null | undefined,
  projects: readonly WitCatalogBootstrapProject[] | null | undefined
): void {
  const bootstrappedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !projects || projects.length === 0) {
      return;
    }
    const token = `${userId}:${projects.length}:${projects[0]?.id ?? ''}`;
    if (bootstrappedFor.current === token) {
      return;
    }
    bootstrappedFor.current = token;

    const entries: Record<string, WitCatalogProjectEntry> = {};
    for (const project of projects) {
      const types = normalizeProjectWorkItemTypeDefs(
        (project.workflow_config as { work_item_types?: unknown } | null)
          ?.work_item_types
      );
      entries[project.id] = {
        revision: project.updated_at ?? catalogRevisionFromDefs(types),
        types,
      };
    }
    mergeWitCatalogProjects(userId, entries);
  }, [userId, projects]);
}
