import { cookies } from 'next/headers';
import type { VisibilityState } from '@tanstack/react-table';
import {
  DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
  WORK_ITEM_TABLE_COLUMNS_COOKIE,
  parseWorkItemTableColumnVisibilityCookie,
} from '@/app/work-items/_helpers/work-item-table-columns-storage';

export type WorkItemTableColumnVisibilityBootstrap = {
  readonly visibility: VisibilityState;
  /** When false, client should migrate from localStorage before painting the table. */
  readonly hasCookie: boolean;
};

/**
 * Server-readable column prefs so the work-items table can SSR in the user’s
 * preferred configuration (cookie is mirrored from localStorage on save).
 */
export async function readWorkItemTableColumnVisibilityBootstrap(): Promise<WorkItemTableColumnVisibilityBootstrap> {
  const jar = await cookies();
  const raw = jar.get(WORK_ITEM_TABLE_COLUMNS_COOKIE)?.value;
  if (!raw) {
    return {
      visibility: { ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY },
      hasCookie: false,
    };
  }

  return {
    visibility: parseWorkItemTableColumnVisibilityCookie(raw),
    hasCookie: true,
  };
}
