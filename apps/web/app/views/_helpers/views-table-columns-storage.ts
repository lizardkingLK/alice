import type { VisibilityState } from '@tanstack/react-table';
import { createLocalColumnStorage } from '@/lib/table-columns/create-local-column-storage';

export const VIEWS_TABLE_COLUMN_IDS = [
  'title',
  'description',
  'path',
  'updated_at',
  'actions',
] as const;

export type ViewsTableColumnId = (typeof VIEWS_TABLE_COLUMN_IDS)[number];

export const VIEWS_TABLE_COLUMN_LABELS: Record<ViewsTableColumnId, string> = {
  title: 'Title',
  description: 'Description',
  path: 'Path',
  updated_at: 'Updated',
  actions: 'Actions',
};

export const DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY: VisibilityState = {
  title: true,
  description: true,
  path: true,
  updated_at: true,
  actions: true,
};

const viewsColumnStorage = createLocalColumnStorage<ViewsTableColumnId>({
  columnIds: VIEWS_TABLE_COLUMN_IDS,
  defaultVisibility: DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
  requiredIds: ['title'],
  storagePrefix: 'alice:views-table-columns:v1:',
});

export const viewsTableColumnsStorageKey = viewsColumnStorage.storageKey;
export const normalizeViewsTableColumnVisibility = viewsColumnStorage.normalize;
export const hasCustomViewsTableColumnVisibility = viewsColumnStorage.hasCustom;
export const readViewsTableColumnVisibility = viewsColumnStorage.read;
export const writeViewsTableColumnVisibility = viewsColumnStorage.write;
export const isRequiredViewsTableColumnId = viewsColumnStorage.isRequired;
export const listViewsTableColumnOptions = viewsColumnStorage.listOptions;
