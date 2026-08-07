/** Max characters per label after trim. */
export const WORK_ITEM_LABEL_MAX_LENGTH = 40;

/** Max labels stored on a single work item. */
export const WORK_ITEM_LABELS_MAX_COUNT = 32;

export class WorkItemLabelsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkItemLabelsValidationError';
  }
}

/** Coerce a DB/JSON value to a string array without validating. */
export function parseWorkItemLabels(value: unknown): string[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function parseLabelsRawInput(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new WorkItemLabelsValidationError(
      'Labels must be a JSON array of strings'
    );
  }
}

function pushNormalizedLabel(
  item: unknown,
  out: string[],
  seen: Set<string>
): void {
  if (typeof item !== 'string') {
    throw new WorkItemLabelsValidationError('Each label must be a string');
  }

  const label = item.trim();
  if (!label || seen.has(label)) {
    return;
  }
  if (label.length > WORK_ITEM_LABEL_MAX_LENGTH) {
    throw new WorkItemLabelsValidationError(
      `Label must be at most ${WORK_ITEM_LABEL_MAX_LENGTH} characters`
    );
  }
  seen.add(label);
  out.push(label);
}

/**
 * Normalize free-form labels from API/FormData.
 * Trims, drops empties, enforces max length/count, case-sensitive uniqueness.
 */
export function normalizeWorkItemLabels(raw: unknown): string[] {
  const input = parseLabelsRawInput(raw);

  if (input == null) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new WorkItemLabelsValidationError(
      'Labels must be an array of strings'
    );
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    pushNormalizedLabel(item, out, seen);
  }

  if (out.length > WORK_ITEM_LABELS_MAX_COUNT) {
    throw new WorkItemLabelsValidationError(
      `At most ${WORK_ITEM_LABELS_MAX_COUNT} labels are allowed`
    );
  }

  return out;
}

export function workItemTitleMatchesSearch(
  title: string,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) {
    return false;
  }
  return title.toLowerCase().includes(term);
}

export function matchingWorkItemLabels(
  labels: readonly string[],
  search: string
): string[] {
  const term = search.trim();
  if (!term) {
    return [];
  }
  return labels.filter((label) => label === term);
}

export function classifyWorkItemSearchMatch(
  item: { title: string; labels?: unknown },
  search: string
): {
  titleMatch: boolean;
  labelMatch: boolean;
  matchedLabels: string[];
} {
  const labels = parseWorkItemLabels(item.labels);
  const matchedLabels = matchingWorkItemLabels(labels, search);
  return {
    titleMatch: workItemTitleMatchesSearch(item.title, search),
    labelMatch: matchedLabels.length > 0,
    matchedLabels,
  };
}

/**
 * PostgREST `.or()` filter: title ILIKE (case-insensitive) OR labels
 * contains the exact search string (case-sensitive `@>` / `cs`).
 */
export function buildWorkItemSearchOrFilter(search: string): string {
  const term = search.trim();
  // Commas/parens split PostgREST `or` clauses — strip from the ilike pattern.
  const ilikeTerm = term.replaceAll(/[,()]/g, '');
  return `title.ilike.%${ilikeTerm}%,labels.cs.${JSON.stringify([term])}`;
}

/**
 * Coerce a FormData/JSON body `labels` value.
 * Empty string → `[]`; valid JSON → parsed value; invalid JSON left as-is for Zod.
 */
export function coerceLabelsFormField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const raw = value.trim();
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return value;
  }
}
