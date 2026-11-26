const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Extract work-item slug / id candidates from a branch name (and optional title).
 *
 * Conventions (case-insensitive):
 * - `{projectKey}-{slug}` e.g. `ALICE-fix-login` or `feature/ALICE-fix-login`
 * - `{projectKey}/{slug}` e.g. `ALICE/fix-login`
 * - bare work-item UUID embedded in the branch
 */
export function extractWorkItemCandidates(
  projectKey: string,
  ...texts: Array<string | null | undefined>
): { slugs: string[]; ids: string[] } {
  const slugs = new Set<string>();
  const ids = new Set<string>();
  const keyPattern = new RegExp(
    `${escapeRegExp(projectKey)}[-_/]([a-z0-9][a-z0-9-]*)`,
    'gi'
  );

  for (const text of texts) {
    if (!text) {
      continue;
    }

    for (const match of text.matchAll(keyPattern)) {
      const slug = match[1]?.toLowerCase();
      if (slug) {
        slugs.add(slug);
      }
    }

    for (const match of text.matchAll(new RegExp(UUID_RE.source, 'gi'))) {
      ids.add(match[0]!.toLowerCase());
    }
  }

  return { slugs: [...slugs], ids: [...ids] };
}
