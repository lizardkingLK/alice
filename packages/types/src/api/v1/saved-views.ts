import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import type { saved_viewsGetPayload } from '../../generated/prisma/models/saved_views.js';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';

/** PostgREST column list for saved-view list/detail reads (RSC + mutation follow-ups). */
export const SAVED_VIEW_POSTGREST_SELECT =
  'id, owner_id, title, description, pathname, search, project_id, status, created_by, created_at, updated_by, updated_at' as const;

/** Prisma `select` for unused Express saved-view GETs (future Prisma list/detail). */
export const savedViewListSelect = {
  id: true,
  owner_id: true,
  title: true,
  description: true,
  pathname: true,
  search: true,
  project_id: true,
  status: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
} as const;

export const savedViewDetailSelect = savedViewListSelect;

export type SavedViewListRow = saved_viewsGetPayload<{
  select: typeof savedViewListSelect;
}>;

export type SavedViewDetailRow = saved_viewsGetPayload<{
  select: typeof savedViewDetailSelect;
}>;

const recordStatusSchema = z.enum(Constants.public.Enums.RecordStatus);

/** Wire shape returned by saved-view mutations (ISO date strings). */
export const savedViewWireSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  pathname: z.string(),
  search: z.string(),
  project_id: z.uuid().nullable(),
  status: recordStatusSchema,
  created_by: z.uuid().nullable(),
  created_at: z.string(),
  updated_by: z.uuid().nullable(),
  updated_at: z.string(),
});

export type SavedViewWire = z.infer<typeof savedViewWireSchema>;

export const createSavedViewBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  pathname: z.string().trim().min(1).max(500),
  search: z.string().max(2000).optional().default(''),
  projectId: z.uuid().nullable().optional(),
});

export type CreateSavedViewBody = z.infer<typeof createSavedViewBodySchema>;

export const updateSavedViewBodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export type UpdateSavedViewBody = z.infer<typeof updateSavedViewBodySchema>;

/** Explicit recipient user ids (owner excluded server-side). */
export const shareSavedViewBodySchema = z.object({
  userIds: z.array(z.uuid()).min(1),
});

export type ShareSavedViewBody = z.infer<typeof shareSavedViewBodySchema>;

export const savedViewStatusQuerySchema = z.enum(['active', 'archived']);

export type SavedViewStatusQuery = z.infer<typeof savedViewStatusQuerySchema>;

/** Query params for unused Express list GET (parity with RSC `getSavedViewsPaginated`). */
export const listSavedViewsQuerySchema = z
  .object({
    page: paginatedListPageField,
    limit: paginatedListLimitField(),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    tab: z.preprocess(
      emptyToUndefined,
      z.enum(['mine', 'shared', 'archived']).optional()
    ),
  })
  .transform((query) => ({
    page: query.page,
    limit: query.limit,
    search: query.search,
    tab: query.tab ?? 'mine',
  }));

export type ListSavedViewsQuery = z.infer<typeof listSavedViewsQuerySchema>;

export const savedViewMutationResponseSchema = z.object({
  data: savedViewWireSchema,
});

export type SavedViewMutationResponse = z.infer<
  typeof savedViewMutationResponseSchema
>;

export const savedViewSuccessResponseSchema = z.object({
  success: z.literal(true),
});

export type SavedViewSuccessResponse = z.infer<
  typeof savedViewSuccessResponseSchema
>;

export const shareSavedViewResponseSchema = z.object({
  data: z.object({
    view: savedViewWireSchema,
    recipientCount: z.number().int().min(0),
  }),
});

export type ShareSavedViewResponse = z.infer<
  typeof shareSavedViewResponseSchema
>;

/** Back-compat aliases for routes importing `*Schema` names from the types root. */
export const createSavedViewSchema = createSavedViewBodySchema;
export const updateSavedViewSchema = updateSavedViewBodySchema;
export const shareSavedViewSchema = shareSavedViewBodySchema;
