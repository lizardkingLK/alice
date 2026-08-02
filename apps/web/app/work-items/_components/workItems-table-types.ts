import type { Row } from '@tanstack/react-table';
import type { WorkItemHierarchyDisplayRow } from '@/app/work-items/_helpers/work-item-hierarchy-rows';

export type DisplayRow = WorkItemHierarchyDisplayRow;

export type HierarchyRendererProps = { row: Row<DisplayRow> };

export type FilterQuery = {
  readonly value: string;
  // eslint-disable-next-line no-unused-vars -- filter setter signature
  readonly setFilter: (value: string) => void;
  readonly allValue: string;
};
