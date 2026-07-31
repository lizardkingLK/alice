import { updateWorkItem } from '@/app/work-items/_services/workItem.service.client';

/** PATCH `parent_id` — pass `null` to unlink (orphan) the work item. */
export async function patchWorkItemParentId(
  workItemId: string,
  parentId: string | null
): Promise<void> {
  const formData = new FormData();
  formData.set('parent_id', parentId ?? '');
  await updateWorkItem(workItemId, formData);
}
