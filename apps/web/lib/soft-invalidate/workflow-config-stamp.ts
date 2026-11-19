/**
 * Stable stamp for comparing `projects.workflow_config` across Realtime
 * payloads and focus re-fetches. Order-sensitive JSON.stringify is enough —
 * we only need inequality detection, not canonical JSON.
 */
export function workflowConfigStamp(config: unknown): string {
  try {
    return JSON.stringify(config ?? null);
  } catch {
    return String(config);
  }
}
