/**
 * Project work-item type catalogs (dynamic keys) + seed defaults.
 * `work_items.type` stores the catalog `key` (plain text).
 *
 * New custom types use opaque UUID keys (never shown in product UI).
 * Seed templates keep stable keys (`Epic`, `Story`, …) for migration.
 */

/** Catalog key stored on work items / filters (UUID or seed / legacy string). */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- intentional public domain alias
export type WorkItemType = string;

const UUID_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `key` looks like a UUID catalog identity. */
export function isUuidWorkItemTypeKey(key: string): boolean {
  return UUID_KEY_PATTERN.test(key.trim());
}

/** Allocate a new opaque catalog key for a custom work-item type. */
export function createProjectWorkItemTypeKey(): string {
  return globalThis.crypto.randomUUID();
}

/** Case-insensitive trimmed name used for uniqueness checks. */
export function normalizeWorkItemTypeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Seed keys used as create defaults / migration templates. */
export const SEED_WORK_ITEM_TYPE_KEYS = [
  'Epic',
  'Feature',
  'Story',
  'Task',
  'Issue',
] as const;

export type SeedWorkItemTypeKey = (typeof SEED_WORK_ITEM_TYPE_KEYS)[number];

/**
 * Seed key constants (names match historical enum members).
 * Prefer catalog lookups at runtime; keep for defaults and gradual migration.
 */
export const WorkItemTypeEnum = {
  Epic: 'Epic',
  Feature: 'Feature',
  Story: 'Story',
  Task: 'Task',
  Issue: 'Issue',
} as const satisfies Record<SeedWorkItemTypeKey, SeedWorkItemTypeKey>;

/** @deprecated Prefer {@link SEED_WORK_ITEM_TYPE_KEYS} / project catalog defs. */
export const WORK_ITEM_TYPES = SEED_WORK_ITEM_TYPE_KEYS;

/** All seed types available when scaffolding a project catalog. */
export const ALL_WORK_ITEM_TYPES: readonly SeedWorkItemTypeKey[] =
  SEED_WORK_ITEM_TYPE_KEYS;

export const CANONICAL_HIERARCHY_ORDER = ALL_WORK_ITEM_TYPES;

/**
 * Default create subset (Feature optional — omitted from default chain).
 * Epic → Story → Task → Issue
 */
export const DEFAULT_SYSTEM_HIERARCHY: readonly SeedWorkItemTypeKey[] = [
  WorkItemTypeEnum.Epic,
  WorkItemTypeEnum.Story,
  WorkItemTypeEnum.Task,
  WorkItemTypeEnum.Issue,
] as const;

export type ProjectWorkItemTypeDef = {
  key: string;
  name: string;
  description?: string;
  icon: string;
  /** Optional accent color (`#RRGGBB`) for badges and catalog cards. */
  color?: string;
  level: number;
};

/**
 * Returns the first duplicate type name (normalized), or null when all unique.
 */
export function findDuplicateWorkItemTypeName(
  defs: readonly Pick<ProjectWorkItemTypeDef, 'name'>[]
): string | null {
  const seen = new Set<string>();
  for (const def of defs) {
    const normalized = normalizeWorkItemTypeName(def.name);
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      return def.name.trim();
    }
    seen.add(normalized);
  }
  return null;
}

const SEED_TYPE_META: Record<
  SeedWorkItemTypeKey,
  Omit<ProjectWorkItemTypeDef, 'key' | 'level'>
> = {
  Epic: {
    name: 'Epic',
    description: 'Top-level initiative',
    icon: 'layers',
    color: '#6B5B95',
  },
  Feature: {
    name: 'Feature',
    description: 'Product capability',
    icon: 'trophy',
    color: '#A855A0',
  },
  Story: {
    name: 'Story',
    description: 'User story / deliverable',
    icon: 'bookmark',
    color: '#3B6FDB',
  },
  Task: {
    name: 'Task',
    description: 'Standard work unit',
    icon: 'square-check',
    color: '#2F9E6B',
  },
  Issue: {
    name: 'Issue',
    description: 'Bug or leaf work item',
    icon: 'circle-alert',
    color: '#D97706',
  },
};

/** Full seed catalog (canonical levels 0..4 including Feature). */
export const DEFAULT_WORK_ITEM_TYPE_DEFS: readonly ProjectWorkItemTypeDef[] =
  SEED_WORK_ITEM_TYPE_KEYS.map((key, level) => ({
    key,
    level,
    ...SEED_TYPE_META[key],
  }));

/**
 * Default defs for new projects: DEFAULT_SYSTEM_HIERARCHY with renumbered levels.
 * Feature is available via {@link DEFAULT_WORK_ITEM_TYPE_DEFS} but not pre-selected.
 */
export function buildDefaultProjectTypeDefs(
  keys: readonly string[] = DEFAULT_SYSTEM_HIERARCHY
): ProjectWorkItemTypeDef[] {
  const ordered = CANONICAL_HIERARCHY_ORDER.filter((key) => keys.includes(key));
  const extras = keys.filter(
    (key) => !CANONICAL_HIERARCHY_ORDER.includes(key as SeedWorkItemTypeKey)
  );
  const defs: ProjectWorkItemTypeDef[] = [];
  let level = 0;
  for (const key of ordered) {
    const meta = SEED_TYPE_META[key];
    defs.push({
      key,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      color: meta.color,
      level,
    });
    level += 1;
  }
  for (const key of extras) {
    defs.push({
      key,
      name: key,
      description: '',
      icon: 'square-check',
      color: '#64748B',
      level,
    });
    level += 1;
  }
  return defs;
}

/** True when value looks like a catalog def object. */
export function isProjectWorkItemTypeDef(
  value: unknown
): value is ProjectWorkItemTypeDef {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.key === 'string' &&
    record.key.trim().length > 0 &&
    typeof record.name === 'string' &&
    record.name.trim().length > 0 &&
    typeof record.icon === 'string' &&
    typeof record.level === 'number' &&
    Number.isFinite(record.level)
  );
}

/**
 * Normalize legacy `string[]` or catalog defs into defs.
 * Assigns levels from canonical order when expanding strings.
 */
export function normalizeProjectWorkItemTypeDefs(
  input: unknown
): ProjectWorkItemTypeDef[] {
  if (!Array.isArray(input) || input.length === 0) {
    return buildDefaultProjectTypeDefs();
  }
  if (input.every(isProjectWorkItemTypeDef)) {
    return [...input].sort((a, b) => a.level - b.level);
  }
  const keys = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (keys.length === 0) {
    return buildDefaultProjectTypeDefs();
  }
  return buildDefaultProjectTypeDefs(keys);
}

export function projectTypeKeys(
  defs: readonly ProjectWorkItemTypeDef[]
): string[] {
  return defs.map((def) => def.key);
}

/** Find a catalog def by key, or null when missing. */
export function findProjectWorkItemTypeDef(
  defs: readonly ProjectWorkItemTypeDef[] | null | undefined,
  key: string | null | undefined
): ProjectWorkItemTypeDef | null {
  if (!defs || !key) {
    return null;
  }
  return defs.find((def) => def.key === key) ?? null;
}

/**
 * Soften legacy slug keys when the catalog is unavailable
 * (`New_type_2` → `New type 2`). Seed keys stay unchanged.
 */
export function humanizeWorkItemTypeKey(key: string): string {
  if ((SEED_WORK_ITEM_TYPE_KEYS as readonly string[]).includes(key)) {
    return key;
  }
  const softened = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return softened || key;
}

/**
 * Display label for a type key. Prefer catalog `name`; never surface UUID keys
 * or raw legacy slug keys in product UI.
 */
export function workItemTypeDisplayName(
  key: string | null | undefined,
  defs?: readonly ProjectWorkItemTypeDef[] | null
): string {
  if (!key) {
    return 'Unknown';
  }
  const fromCatalog = findProjectWorkItemTypeDef(defs, key)?.name.trim();
  if (fromCatalog) {
    return fromCatalog;
  }
  if (isUuidWorkItemTypeKey(key)) {
    return 'Custom type';
  }
  return humanizeWorkItemTypeKey(key);
}

/** Keys from legacy string[] or catalog defs (empty → default seed keys). */
export function resolveProjectTypeKeys(workItemTypes: unknown): string[] {
  return projectTypeKeys(normalizeProjectWorkItemTypeDefs(workItemTypes));
}

/**
 * Default parent → child for seed hierarchy (Feature → Story when present).
 * Prefer {@link resolveProjectHierarchyFromLevels} for project catalogs.
 */
export const WORK_ITEM_CHILD_TYPE: Partial<Record<string, string>> = {
  [WorkItemTypeEnum.Epic]: WorkItemTypeEnum.Story,
  [WorkItemTypeEnum.Feature]: WorkItemTypeEnum.Story,
  [WorkItemTypeEnum.Story]: WorkItemTypeEnum.Task,
  [WorkItemTypeEnum.Task]: WorkItemTypeEnum.Issue,
};

export type ResolvedProjectHierarchy = {
  parentToChild: Partial<Record<string, string>>;
  childToParent: Partial<Record<string, string>>;
};

function isTypePermitted(
  type: string,
  allowedTypes?: readonly string[] | null
): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true;
  }
  return allowedTypes.includes(type);
}

/**
 * Linear hierarchy from catalog levels (unique levels, sort ascending).
 */
export function resolveProjectHierarchyFromLevels(
  defs: readonly ProjectWorkItemTypeDef[]
): ResolvedProjectHierarchy {
  const parentToChild: Partial<Record<string, string>> = {};
  const childToParent: Partial<Record<string, string>> = {};
  const ordered = [...defs].sort((a, b) => a.level - b.level);
  for (let i = 0; i < ordered.length - 1; i++) {
    const parent = ordered[i]!;
    const child = ordered[i + 1]!;
    parentToChild[parent.key] = child.key;
    childToParent[child.key] = parent.key;
  }
  return { parentToChild, childToParent };
}

function resolveCustomHierarchy(
  customHierarchy: Record<string, string | null>,
  allowedTypes?: readonly string[] | null
): ResolvedProjectHierarchy {
  const parentToChild: Partial<Record<string, string>> = {};
  const childToParent: Partial<Record<string, string>> = {};

  for (const [parent, child] of Object.entries(customHierarchy)) {
    if (
      child &&
      isTypePermitted(parent, allowedTypes) &&
      isTypePermitted(child, allowedTypes)
    ) {
      parentToChild[parent] = child;
      childToParent[child] = parent;
    }
  }

  return { parentToChild, childToParent };
}

function resolveDefaultHierarchy(
  allowedTypes?: readonly string[] | null
): ResolvedProjectHierarchy {
  const effectiveTypes =
    allowedTypes && allowedTypes.length > 0
      ? DEFAULT_SYSTEM_HIERARCHY.filter((type) => allowedTypes.includes(type))
      : [...DEFAULT_SYSTEM_HIERARCHY];

  return resolveProjectHierarchyFromLevels(
    buildDefaultProjectTypeDefs(effectiveTypes)
  );
}

/**
 * Resolves parent-child hierarchy for a project.
 * Preference: catalog defs (levels) → custom hierarchy map → default seed chain.
 */
export function resolveProjectHierarchy(
  allowedTypes?: readonly string[] | null,
  customHierarchy?: Record<string, string | null> | null,
  typeDefs?: readonly ProjectWorkItemTypeDef[] | null
): ResolvedProjectHierarchy {
  if (typeDefs && typeDefs.length > 0) {
    const scoped =
      allowedTypes && allowedTypes.length > 0
        ? typeDefs.filter((def) => allowedTypes.includes(def.key))
        : typeDefs;
    return resolveProjectHierarchyFromLevels(scoped);
  }
  if (customHierarchy && Object.keys(customHierarchy).length > 0) {
    return resolveCustomHierarchy(customHierarchy, allowedTypes);
  }
  return resolveDefaultHierarchy(allowedTypes);
}

export function getAllowedChildType(
  parentType: string,
  allowedTypes?: readonly string[] | null,
  customHierarchy?: Record<string, string | null> | null,
  typeDefs?: readonly ProjectWorkItemTypeDef[] | null
): string | null {
  if (!allowedTypes && !customHierarchy && !typeDefs) {
    return WORK_ITEM_CHILD_TYPE[parentType] ?? null;
  }
  const { parentToChild } = resolveProjectHierarchy(
    allowedTypes,
    customHierarchy,
    typeDefs
  );
  return parentToChild[parentType] ?? null;
}

/**
 * Child → allowed parent type (inverse of {@link getAllowedChildType}).
 */
export function getAllowedParentType(
  childType: string,
  allowedTypes?: readonly string[] | null,
  customHierarchy?: Record<string, string | null> | null,
  typeDefs?: readonly ProjectWorkItemTypeDef[] | null
): string | null {
  if (!allowedTypes && !customHierarchy && !typeDefs) {
    if (childType === WorkItemTypeEnum.Story) {
      return WorkItemTypeEnum.Epic;
    }
    for (const [parentType, allowedChild] of Object.entries(
      WORK_ITEM_CHILD_TYPE
    )) {
      if (allowedChild === childType) {
        return parentType;
      }
    }
    return null;
  }
  const { childToParent } = resolveProjectHierarchy(
    allowedTypes,
    customHierarchy,
    typeDefs
  );
  return childToParent[childType] ?? null;
}

/**
 * Static mapping of raw strings (including aliases) to seed type keys.
 */
export const WORK_ITEM_TYPE_MAPPINGS: Record<string, SeedWorkItemTypeKey> = {
  epic: WorkItemTypeEnum.Epic,
  feature: WorkItemTypeEnum.Feature,
  story: WorkItemTypeEnum.Story,
  'user story': WorkItemTypeEnum.Story,
  task: WorkItemTypeEnum.Task,
  'sub-task': WorkItemTypeEnum.Task,
  subtask: WorkItemTypeEnum.Task,
  bug: WorkItemTypeEnum.Issue,
  defect: WorkItemTypeEnum.Issue,
  issue: WorkItemTypeEnum.Issue,
};

/**
 * Maps a free-form string to a seed type key (import defaults).
 * Prefer project-catalog resolution when defs are available.
 */
export function mapToWorkItemType(
  input: string | null | undefined
): SeedWorkItemTypeKey {
  if (!input) {
    return WorkItemTypeEnum.Task;
  }
  const normalized = input.trim().toLowerCase();
  return WORK_ITEM_TYPE_MAPPINGS[normalized] ?? WorkItemTypeEnum.Task;
}

/**
 * Map an external type label to a project catalog key.
 * Tries exact key, case-insensitive name, then seed alias map constrained to catalog.
 */
export function mapToProjectWorkItemTypeKey(
  input: string | null | undefined,
  defs: readonly ProjectWorkItemTypeDef[],
  fallbackKey?: string
): string {
  const fallback =
    fallbackKey && defs.some((def) => def.key === fallbackKey)
      ? fallbackKey
      : (defs.find((def) => def.key === WorkItemTypeEnum.Task)?.key ??
        defs.at(-1)?.key ??
        WorkItemTypeEnum.Task);

  if (!input) {
    return fallback;
  }

  const trimmed = input.trim();
  const byKey = defs.find((def) => def.key === trimmed);
  if (byKey) {
    return byKey.key;
  }

  const lower = trimmed.toLowerCase();
  const byName = defs.find((def) => def.name.trim().toLowerCase() === lower);
  if (byName) {
    return byName.key;
  }

  const seed = WORK_ITEM_TYPE_MAPPINGS[lower];
  if (seed && defs.some((def) => def.key === seed)) {
    return seed;
  }

  return fallback;
}
