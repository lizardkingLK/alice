import {
  REGISTRY_PAGES,
  type RegistryPageMeta,
  type RegistrySkeletonProps,
} from '@/components/registry-page-shell';
import { readWorkItemTableColumnVisibilityBootstrap } from '@/app/work-items/_helpers/work-item-table-columns-cookie.server';
import { countVisibleWorkItemTableColumns } from '@/app/work-items/_helpers/work-item-table-columns-storage';

/**
 * Suspense / `loading.tsx` skeleton props for work-item registries, using the
 * column-visibility cookie when present (else the stock default count).
 */
export async function getWorkItemsRegistrySkeletonProps(): Promise<RegistrySkeletonProps> {
  const { visibility } = await readWorkItemTableColumnVisibilityBootstrap();
  return {
    ...REGISTRY_PAGES.workItems.skeleton,
    columnCount: countVisibleWorkItemTableColumns(visibility),
  };
}

export async function getWorkItemsRegistryPageMeta(): Promise<RegistryPageMeta> {
  return {
    description: REGISTRY_PAGES.workItems.description,
    skeleton: await getWorkItemsRegistrySkeletonProps(),
  };
}
