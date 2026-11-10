/** Max length for persisted URL slugs (path segments). */
export const SLUG_MAX_LENGTH = 80;

/** Strip leading/trailing `-` without regex backtracking. */
function trimHyphens(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 45 /* - */) {
    start += 1;
  }
  while (end > start && value.charCodeAt(end - 1) === 45 /* - */) {
    end -= 1;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
}

/** Strip trailing `-` without regex backtracking. */
function trimTrailingHyphens(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 45 /* - */) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

/**
 * Lowercase kebab slug from a display name/title.
 * Empty / punctuation-only input falls back to `item`.
 */
export function slugifyTitle(
  value: string,
  maxLength = SLUG_MAX_LENGTH
): string {
  const normalized = trimTrailingHyphens(
    trimHyphens(
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
    ).slice(0, maxLength)
  );

  return normalized.length > 0 ? normalized : 'item';
}

/**
 * Next unique slug given a preferred base and the set of already-taken slugs
 * in the same project scope.
 */
export function allocateUniqueSlug(
  preferred: string,
  taken: ReadonlySet<string>,
  maxLength = SLUG_MAX_LENGTH
): string {
  const base = slugifyTitle(preferred, maxLength);
  if (!taken.has(base)) {
    return base;
  }

  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `-${n}`;
    const truncated = base.slice(0, Math.max(1, maxLength - suffix.length));
    const candidate = `${trimTrailingHyphens(truncated)}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, Math.max(1, maxLength - 9))}-${Date.now()}`;
}
