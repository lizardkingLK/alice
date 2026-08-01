'use server';

import {
  getWorkItems,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';

export async function loadWorkItemChildrenAction(
  parentId: string
): Promise<DbWorkItem[]> {
  if (!parentId.trim()) {
    return [];
  }

  return getWorkItems({ parentId });
}
