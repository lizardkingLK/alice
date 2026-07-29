import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const BACKLOG_LAYOUT_IDS = [
  'stack',
  'stack-reverse',
  'split-sprints-left',
  'split-backlog-left',
] as const;

export type BacklogLayoutId = (typeof BACKLOG_LAYOUT_IDS)[number];

export type BacklogLayoutOption = {
  readonly id: BacklogLayoutId;
  readonly label: string;
  readonly description: string;
};

export const BACKLOG_LAYOUT_OPTIONS: readonly BacklogLayoutOption[] = [
  {
    id: 'stack',
    label: 'Sprints above backlog',
    description: 'Classic stacked view',
  },
  {
    id: 'stack-reverse',
    label: 'Backlog above sprints',
    description: 'Backlog first, then sprints',
  },
  {
    id: 'split-sprints-left',
    label: 'Sprints | Backlog (2∶1)',
    description: 'Sprints on left, Backlog on right',
  },
  {
    id: 'split-backlog-left',
    label: 'Backlog | Sprints (2∶1)',
    description: 'Backlog on left, sprints on right',
  },
];

const STORAGE_PREFIX = 'alice:backlog-layout:';
const DEFAULT_LAYOUT: BacklogLayoutId = 'stack';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isLayoutId(value: unknown): value is BacklogLayoutId {
  return (
    typeof value === 'string' &&
    (BACKLOG_LAYOUT_IDS as readonly string[]).includes(value)
  );
}

export function readBacklogLayout(
  userId: string | null | undefined
): BacklogLayoutId {
  if (!userId) {
    return DEFAULT_LAYOUT;
  }

  const parsed = getLocalStorageJson<unknown>(storageKey(userId));
  return isLayoutId(parsed) ? parsed : DEFAULT_LAYOUT;
}

export function writeBacklogLayout(
  userId: string | null | undefined,
  layout: BacklogLayoutId
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), layout);
}

export function getEffectiveBacklogLayout(
  preferred: BacklogLayoutId,
  options: {
    readonly isDesktop: boolean;
    readonly showBacklogPane: boolean;
  }
): BacklogLayoutId {
  if (!options.showBacklogPane || !options.isDesktop) {
    if (preferred === 'stack-reverse' && options.showBacklogPane) {
      return 'stack-reverse';
    }
    return 'stack';
  }
  return preferred;
}

export function getBacklogLayoutContainerClass(
  layout: BacklogLayoutId
): string {
  switch (layout) {
    case 'stack-reverse':
      return 'flex flex-col-reverse gap-4';
    case 'split-sprints-left':
      return 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)] lg:items-start';
    case 'split-backlog-left':
      return 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start';
    case 'stack':
    default:
      return 'flex flex-col gap-4';
  }
}

export function getBacklogSprintsPaneClass(layout: BacklogLayoutId): string {
  switch (layout) {
    case 'split-sprints-left':
      return 'min-w-0 space-y-4 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1';
    case 'split-backlog-left':
      return 'min-w-0 space-y-4 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1';
    default:
      return 'min-w-0 space-y-4';
  }
}

export function getBacklogIssuesPaneClass(layout: BacklogLayoutId): string {
  switch (layout) {
    case 'split-sprints-left':
      return 'min-w-0 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1';
    case 'split-backlog-left':
      return 'min-w-0 lg:col-start-1 lg:row-start-1 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1';
    default:
      return 'min-w-0';
  }
}
