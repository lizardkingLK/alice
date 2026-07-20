import type { LayoutItem } from 'react-grid-layout';
import type { ChartConfig } from '@repo/ui/components/ui/chart';

export type WidgetId =
  | 'open-issues'
  | 'in-progress'
  | 'completed'
  | 'team-members'
  | 'status-mix'
  | 'sprint-burndown'
  | 'velocity'
  | 'recent-activity';

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
};

export const WIDGET_CATALOG: WidgetDefinition[] = [
  {
    id: 'open-issues',
    title: 'Open Issues',
    description: 'Assigned to you',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    description: 'Active this sprint',
  },
  {
    id: 'completed',
    title: 'Completed',
    description: 'Closed this month',
  },
  {
    id: 'team-members',
    title: 'Team Members',
    description: 'Across your projects',
  },
  {
    id: 'status-mix',
    title: 'Work by status',
    description: 'Distribution across the board',
  },
  {
    id: 'sprint-burndown',
    title: 'Sprint burndown',
    description: 'Remaining points this sprint',
  },
  {
    id: 'velocity',
    title: 'Team velocity',
    description: 'Completed story points',
  },
  {
    id: 'recent-activity',
    title: 'Recent activity',
    description: 'Latest updates across projects',
  },
];

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'open-issues', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
  { i: 'in-progress', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
  { i: 'completed', x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
  { i: 'team-members', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
  { i: 'status-mix', x: 0, y: 3, w: 6, h: 8, minW: 4, minH: 6 },
  { i: 'sprint-burndown', x: 6, y: 3, w: 6, h: 8, minW: 4, minH: 6 },
  { i: 'velocity', x: 0, y: 11, w: 6, h: 8, minW: 4, minH: 6 },
  { i: 'recent-activity', x: 6, y: 11, w: 6, h: 8, minW: 4, minH: 6 },
];

export const LAYOUT_STORAGE_KEY = 'alice.dashboard.overview.layout.v1';

export const STAT_VALUES = {
  'open-issues': { value: '12', delta: '+2 this week' },
  'in-progress': { value: '4', delta: 'On track' },
  completed: { value: '28', delta: '+6 vs last month' },
  'team-members': { value: '8', delta: '3 active now' },
} as const;

export const STATUS_MIX_DATA = [
  { status: 'new', count: 8, fill: 'var(--color-new)' },
  { status: 'todo', count: 12, fill: 'var(--color-todo)' },
  { status: 'progress', count: 9, fill: 'var(--color-progress)' },
  { status: 'testing', count: 5, fill: 'var(--color-testing)' },
  { status: 'done', count: 18, fill: 'var(--color-done)' },
] as const;

export const STATUS_MIX_CONFIG = {
  new: { label: 'New', color: 'var(--chart-1)' },
  todo: { label: 'To Do', color: 'var(--chart-2)' },
  progress: { label: 'In Progress', color: 'var(--chart-3)' },
  testing: { label: 'Testing', color: 'var(--chart-4)' },
  done: { label: 'Done', color: 'var(--chart-5)' },
  count: { label: 'Issues' },
} satisfies ChartConfig;

export const BURNDOWN_DATA = [
  { day: 'Mon', remaining: 42, ideal: 42 },
  { day: 'Tue', remaining: 38, ideal: 35 },
  { day: 'Wed', remaining: 33, ideal: 28 },
  { day: 'Thu', remaining: 27, ideal: 21 },
  { day: 'Fri', remaining: 22, ideal: 14 },
  { day: 'Mon', remaining: 16, ideal: 7 },
  { day: 'Tue', remaining: 11, ideal: 0 },
] as const;

export const BURNDOWN_CONFIG = {
  remaining: { label: 'Remaining', color: 'var(--chart-1)' },
  ideal: { label: 'Ideal', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

export const VELOCITY_DATA = [
  { sprint: 'S12', points: 24 },
  { sprint: 'S13', points: 31 },
  { sprint: 'S14', points: 28 },
  { sprint: 'S15', points: 35 },
  { sprint: 'S16', points: 33 },
  { sprint: 'S17', points: 39 },
] as const;

export const VELOCITY_CONFIG = {
  points: { label: 'Points', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export const ACTIVITY_ITEMS = [
  {
    id: 'a1',
    title: 'Moved "Auth middleware" to In Progress',
    meta: 'Board · 12 minutes ago',
  },
  {
    id: 'a2',
    title: 'Commented on "Sprint planning notes"',
    meta: 'Work items · 1 hour ago',
  },
  {
    id: 'a3',
    title: 'Completed "API contract draft"',
    meta: 'Backlog · Yesterday',
  },
  {
    id: 'a4',
    title: 'Joined project "Customer Portal"',
    meta: 'Projects · 2 days ago',
  },
  {
    id: 'a5',
    title: 'Uploaded release checklist.pdf',
    meta: 'Files · 3 days ago',
  },
] as const;
