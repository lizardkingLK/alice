/**
 * Re-exports shared PostgREST list/detail selects from `@repo/types` v1 wire DTOs.
 * Keeps RSC supabase-js reads aligned with unused Express Prisma GETs.
 */
export {
  WORK_ITEM_ASSIGNEE_POSTGREST_SELECT as ASSIGNEE_SELECT,
  WORK_ITEM_LIST_POSTGREST_COLUMNS as WORK_ITEM_LIST_COLUMNS,
  WORK_ITEM_REPORTER_POSTGREST_SELECT as REPORTER_SELECT,
  workItemDetailPostgrestSelect,
  workItemListPostgrestSelect as workItemListSelect,
} from '@repo/types';
