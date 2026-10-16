import type { LayoutItem } from 'react-grid-layout';
import type { ProductivityWidgetId } from '@/app/dashboard/_helpers/productivity-dashboard-preferences';

export type ProductivityWidgetDefinition = {
  readonly id: ProductivityWidgetId;
  readonly title: string;
  readonly description: string;
};

export const PRODUCTIVITY_WIDGET_CATALOG: readonly ProductivityWidgetDefinition[] =
  [
    {
      id: 'my-work-assigned',
      title: 'Assigned to you',
      description: 'Open work items',
    },
    {
      id: 'my-work-pending-stories',
      title: 'Pending stories',
      description: 'Stories still open',
    },
    {
      id: 'my-work-in-progress',
      title: 'In progress',
      description: 'Actively moving',
    },
    {
      id: 'projects',
      title: 'Your projects',
      description: 'Membership and ownership',
    },
    {
      id: 'alice',
      title: 'Alice',
      description: 'Quick chat on Overview',
    },
    {
      id: 'docs',
      title: 'Docs',
      description: 'Guides and how-tos',
    },
    {
      id: 'pomodoro',
      title: 'Pomodoro',
      description: '25-minute focus timer',
    },
  ];

/** Matches the Overview productivity arrangement (KPIs + Pomodoro top; Projects / Alice / Docs below). */
export const PRODUCTIVITY_DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'my-work-assigned', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'my-work-pending-stories', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'my-work-in-progress', x: 6, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'pomodoro', x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 5 },
  { i: 'projects', x: 0, y: 3, w: 4, h: 9, minW: 4, minH: 5 },
  { i: 'alice', x: 4, y: 3, w: 4, h: 9, minW: 4, minH: 8 },
  { i: 'docs', x: 8, y: 6, w: 4, h: 6, minW: 4, minH: 5 },
];
