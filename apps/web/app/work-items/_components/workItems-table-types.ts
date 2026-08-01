import type { Row } from '@tanstack/react-table';
import type { WorkItemHierarchyDisplayRow } from '@/app/work-items/_helpers/work-item-hierarchy-rows';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

export type DisplayRow = WorkItemHierarchyDisplayRow;

/** Shared by status/type/priority badge cell renderers (flat `DbWorkItem` rows). */
export type RendererProps = { row: Row<DbWorkItem> };

export type HierarchyRendererProps = { row: Row<DisplayRow> };

export type FilterQuery = {
  readonly value: string;
  // eslint-disable-next-line no-unused-vars -- filter setter signature
  readonly setFilter: (value: string) => void;
  readonly allValue: string;
};
