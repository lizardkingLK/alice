/**
 * Per-user work-item details layout preferences (browser localStorage + cookie).
 * Cross-project; does not sync across devices.
 */

import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const WORK_ITEM_DETAILS_PREFS_COOKIE = 'alice_wi_details_prefs_v1';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const STORAGE_PREFIX = 'alice:work-item-details-prefs:v1:';

export const WORK_ITEM_BANNER_COLOR_SOURCES = ['state', 'type'] as const;
export type WorkItemBannerColorSource =
  (typeof WORK_ITEM_BANNER_COLOR_SOURCES)[number];

export const WORK_ITEM_TITLE_ICON_SOURCES = ['type', 'state', 'none'] as const;
export type WorkItemTitleIconSource =
  (typeof WORK_ITEM_TITLE_ICON_SOURCES)[number];

export type WorkItemDetailsOptionalSectionId =
  | 'details'
  | 'attachments'
  | 'development'
  | 'discussion'
  | 'moreFields'
  | 'subtasks'
  | 'linkedIssues';

export type WorkItemDetailsFieldId =
  'assignee' | 'reporter' | 'priority' | 'sprint' | 'dueDate' | 'labels';

export type WorkItemMoreFieldsItemId =
  | 'timeTracking'
  | 'storyPoints'
  | 'shortId'
  | 'createdAt'
  | 'updatedAt'
  | 'resolvedAt';

export type WorkItemDetailsPreferences = {
  readonly bannerColor: WorkItemBannerColorSource;
  readonly titleIcon: WorkItemTitleIconSource;
  readonly sections: Readonly<
    Record<WorkItemDetailsOptionalSectionId, boolean>
  >;
  readonly detailsFields: Readonly<Record<WorkItemDetailsFieldId, boolean>>;
  readonly moreFieldsItems: Readonly<Record<WorkItemMoreFieldsItemId, boolean>>;
};

export const DEFAULT_WORK_ITEM_DETAILS_PREFERENCES: WorkItemDetailsPreferences =
  {
    bannerColor: 'state',
    titleIcon: 'type',
    sections: {
      details: true,
      attachments: true,
      development: true,
      discussion: true,
      moreFields: true,
      subtasks: true,
      linkedIssues: true,
    },
    detailsFields: {
      assignee: true,
      reporter: true,
      priority: true,
      sprint: true,
      dueDate: true,
      labels: true,
    },
    moreFieldsItems: {
      timeTracking: true,
      storyPoints: true,
      shortId: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
    },
  };

export const OPTIONAL_SECTION_LABELS: Record<
  WorkItemDetailsOptionalSectionId,
  string
> = {
  details: 'Details',
  attachments: 'Attachments',
  development: 'Development',
  discussion: 'Discussion',
  moreFields: 'More fields',
  subtasks: 'Subtasks',
  linkedIssues: 'Linked issues',
};

export const DETAILS_FIELD_LABELS: Record<WorkItemDetailsFieldId, string> = {
  assignee: 'Assignee',
  reporter: 'Reporter',
  priority: 'Priority',
  sprint: 'Sprint',
  dueDate: 'Due date',
  labels: 'Labels',
};

export const MORE_FIELDS_ITEM_LABELS: Record<WorkItemMoreFieldsItemId, string> =
  {
    timeTracking: 'Time tracking',
    storyPoints: 'Story points',
    shortId: 'Short ID',
    createdAt: 'Created date',
    updatedAt: 'Updated date',
    resolvedAt: 'Resolved date',
  };

export const BANNER_COLOR_OPTIONS: readonly {
  readonly value: WorkItemBannerColorSource;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'state',
    label: 'State color',
    description: 'Tint the banner from the current workflow state',
  },
  {
    value: 'type',
    label: 'Type color',
    description: 'Tint the banner from the work-item type',
  },
];

export const TITLE_ICON_OPTIONS: readonly {
  readonly value: WorkItemTitleIconSource;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'type',
    label: 'Type icon',
    description: 'Show the work-item type icon beside the title',
  },
  {
    value: 'state',
    label: 'State icon',
    description: 'Show the workflow state icon beside the title',
  },
  {
    value: 'none',
    label: 'None',
    description: 'Hide the title icon',
  },
];

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isBannerColor(value: unknown): value is WorkItemBannerColorSource {
  return (
    typeof value === 'string' &&
    (WORK_ITEM_BANNER_COLOR_SOURCES as readonly string[]).includes(value)
  );
}

function isTitleIcon(value: unknown): value is WorkItemTitleIconSource {
  return (
    typeof value === 'string' &&
    (WORK_ITEM_TITLE_ICON_SOURCES as readonly string[]).includes(value)
  );
}

function asBooleanRecord<K extends string>(
  value: unknown,
  keys: readonly K[],
  defaults: Readonly<Record<K, boolean>>
): Record<K, boolean> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const next = { ...defaults } as Record<K, boolean>;
  for (const key of keys) {
    if (typeof source[key] === 'boolean') {
      next[key] = source[key];
    }
  }
  return next;
}

export function normalizeWorkItemDetailsPreferences(
  value: unknown
): WorkItemDetailsPreferences {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    bannerColor: isBannerColor(source.bannerColor)
      ? source.bannerColor
      : DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.bannerColor,
    titleIcon: isTitleIcon(source.titleIcon)
      ? source.titleIcon
      : DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.titleIcon,
    sections: asBooleanRecord(
      source.sections,
      [
        'details',
        'attachments',
        'development',
        'discussion',
        'moreFields',
        'subtasks',
        'linkedIssues',
      ] as const,
      DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.sections
    ),
    detailsFields: asBooleanRecord(
      source.detailsFields,
      [
        'assignee',
        'reporter',
        'priority',
        'sprint',
        'dueDate',
        'labels',
      ] as const,
      DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.detailsFields
    ),
    moreFieldsItems: asBooleanRecord(
      source.moreFieldsItems,
      [
        'timeTracking',
        'storyPoints',
        'shortId',
        'createdAt',
        'updatedAt',
        'resolvedAt',
      ] as const,
      DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.moreFieldsItems
    ),
  };
}

export function encodeWorkItemDetailsPreferencesCookie(
  prefs: WorkItemDetailsPreferences
): string {
  return encodeURIComponent(
    JSON.stringify(normalizeWorkItemDetailsPreferences(prefs))
  );
}

export function parseWorkItemDetailsPreferencesCookie(
  raw: string | undefined | null
): WorkItemDetailsPreferences {
  if (!raw) {
    return { ...cloneDefaults() };
  }

  try {
    return normalizeWorkItemDetailsPreferences(
      JSON.parse(decodeURIComponent(raw)) as unknown
    );
  } catch {
    try {
      return normalizeWorkItemDetailsPreferences(JSON.parse(raw) as unknown);
    } catch {
      return { ...cloneDefaults() };
    }
  }
}

function cloneDefaults(): WorkItemDetailsPreferences {
  return normalizeWorkItemDetailsPreferences(
    DEFAULT_WORK_ITEM_DETAILS_PREFERENCES
  );
}

function writeWorkItemDetailsPreferencesCookie(
  prefs: WorkItemDetailsPreferences
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const value = encodeWorkItemDetailsPreferencesCookie(prefs);
  document.cookie = [
    `${WORK_ITEM_DETAILS_PREFS_COOKIE}=${value}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
}

/**
 * Returns null when this browser has no stored blob yet (caller may keep
 * cookie/SSR defaults instead of resetting to stock defaults).
 */
export function readWorkItemDetailsPreferencesLocal(
  userId: string | null | undefined
): WorkItemDetailsPreferences | null {
  if (!userId) {
    return null;
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (raw == null) {
    return null;
  }
  return normalizeWorkItemDetailsPreferences(raw);
}

export function readWorkItemDetailsPreferences(
  userId: string | null | undefined
): WorkItemDetailsPreferences {
  return readWorkItemDetailsPreferencesLocal(userId) ?? cloneDefaults();
}

export function writeWorkItemDetailsPreferences(
  userId: string | null | undefined,
  prefs: WorkItemDetailsPreferences
): void {
  const normalized = normalizeWorkItemDetailsPreferences(prefs);
  writeWorkItemDetailsPreferencesCookie(normalized);
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), normalized);
}

export function workItemDetailsPreferencesEquals(
  left: WorkItemDetailsPreferences,
  right: WorkItemDetailsPreferences
): boolean {
  return (
    left.bannerColor === right.bannerColor &&
    left.titleIcon === right.titleIcon &&
    (Object.keys(left.sections) as WorkItemDetailsOptionalSectionId[]).every(
      (key) => left.sections[key] === right.sections[key]
    ) &&
    (Object.keys(left.detailsFields) as WorkItemDetailsFieldId[]).every(
      (key) => left.detailsFields[key] === right.detailsFields[key]
    ) &&
    (Object.keys(left.moreFieldsItems) as WorkItemMoreFieldsItemId[]).every(
      (key) => left.moreFieldsItems[key] === right.moreFieldsItems[key]
    )
  );
}
