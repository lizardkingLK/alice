/** Chart workspace id from `/charts/[uuid]` (ignores trailing widget segments). */
const CHART_PATH_ID =
  /^\/charts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function parseChartWorkspaceIdFromPathname(
  pathname: string
): string | null {
  const match = CHART_PATH_ID.exec(pathname);
  return match?.[1] ?? null;
}
