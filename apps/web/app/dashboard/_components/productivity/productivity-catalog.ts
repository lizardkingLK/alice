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
      id: 'my-work-categories',
      title: 'Categories',
      description: 'Assigned, in progress, and pending stories',
    },
    {
      id: 'my-work-wip',
      title: 'Work in progress',
      description: 'Top open assigned items',
    },
    {
      id: 'notifications',
      title: 'Unread notifications',
      description: 'Latest unread alerts',
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
      title: 'Focus',
      description: 'Timer, tasks, calendar, and music',
    },
  ];

/** Default Overview: Focus (Calendar + Music are panes inside Focus). */
export const PRODUCTIVITY_DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'pomodoro', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 8 },
  { i: 'alice', x: 6, y: 0, w: 6, h: 10, minW: 4, minH: 8 },
  { i: 'my-work-categories', x: 6, y: 10, w: 3, h: 4, minW: 2, minH: 3 },
  { i: 'my-work-wip', x: 0, y: 12, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'notifications', x: 6, y: 14, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'projects', x: 0, y: 20, w: 4, h: 9, minW: 4, minH: 5 },
  { i: 'docs', x: 9, y: 10, w: 3, h: 6, minW: 3, minH: 5 },
];
