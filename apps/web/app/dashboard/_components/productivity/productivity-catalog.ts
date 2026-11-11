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
      description: 'Timer and personal todos',
    },
  ];

/** Default Overview: Alice + Focus side by side. */
export const PRODUCTIVITY_DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'alice', x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 8 },
  { i: 'pomodoro', x: 6, y: 0, w: 6, h: 12, minW: 4, minH: 8 },
  { i: 'my-work-assigned', x: 0, y: 12, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'my-work-pending-stories', x: 3, y: 12, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'my-work-in-progress', x: 6, y: 12, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'my-work-wip', x: 0, y: 15, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'notifications', x: 6, y: 15, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'projects', x: 0, y: 23, w: 4, h: 9, minW: 4, minH: 5 },
  { i: 'docs', x: 8, y: 12, w: 4, h: 6, minW: 4, minH: 5 },
];
