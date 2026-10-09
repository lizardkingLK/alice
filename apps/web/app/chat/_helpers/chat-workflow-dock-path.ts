/**
 * True when the floating Alice drawer should hide in favor of the
 * workflow-designer docked panel (`/projects/:id?tab=workflow`).
 */
export function isWorkflowDesignerPath(
  pathname: string,
  // eslint-disable-next-line no-unused-vars -- documents query API
  getSearchParam: (key: string) => string | null
): boolean {
  return (
    pathname.startsWith('/projects/') && getSearchParam('tab') === 'workflow'
  );
}
