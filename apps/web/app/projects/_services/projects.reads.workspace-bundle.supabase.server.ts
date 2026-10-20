import {
  parseProjectWorkspaceBundle,
  type ProjectWorkspaceBundlePayload,
} from '@/app/projects/_helpers/project-workspace-bundle';
import { isMissingRpcError } from '@/lib/db/query';
import { createClient } from '@/lib/supabase/server';

/**
 * Project details core via `get_project_workspace_bundle` (project + members +
 * badge counts). Returns null when the function is missing (pre-migrate) so
 * callers can fall back to parallel PostgREST readers.
 */
export async function getProjectWorkspaceBundleFromRpc(
  projectId: string
): Promise<ProjectWorkspaceBundlePayload | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_project_workspace_bundle', {
    p_project_id: projectId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return null;
    }
    console.error(
      'error. failed to fetch project workspace bundle:',
      error.message
    );
    return null;
  }

  if (data == null) {
    return null;
  }

  return parseProjectWorkspaceBundle(data);
}
