import type { ChatViewContext } from '@repo/types/api/v1';

/** `/projects/<uuid>` or nested project routes under that segment. */
const PROJECT_PATH_PATTERN =
  /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i;

/**
 * Infer Alice Chat project context for model resolution.
 * Prefer an explicit view-bridge projectId; else parse the dock page pathname.
 */
export function resolveChatProjectId(params: {
  readonly viewContext?: ChatViewContext | null;
  readonly pathname?: string | null;
}): string | undefined {
  const fromView = params.viewContext?.projectId;
  if (typeof fromView === 'string' && fromView.length > 0) {
    return fromView;
  }

  const pathname = params.pathname?.trim();
  if (!pathname) {
    return undefined;
  }

  const match = PROJECT_PATH_PATTERN.exec(pathname);
  return match?.[1];
}
