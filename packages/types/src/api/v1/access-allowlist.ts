import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import type { access_allowlistGetPayload } from '../../generated/prisma/models/access_allowlist.js';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';

/** Prisma `select` for Express allowlist list GET (no secrets). */
export const accessAllowlistListSelect = {
  id: true,
  kind: true,
  value: true,
  label: true,
  expires_at: true,
  allowed_project_ids: true,
  status: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
} as const;

export type AccessAllowlistListRow = access_allowlistGetPayload<{
  select: typeof accessAllowlistListSelect;
}>;

const recordStatusSchema = z.enum(Constants.public.Enums.RecordStatus);

/** Query params for Express list GET (parity with RSC `listAccessAllowlist`). */
export const listAccessAllowlistQuerySchema = z
  .object({
    page: paginatedListPageField,
    limit: paginatedListLimitField(),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    status: z.preprocess(
      emptyToUndefined,
      z.union([recordStatusSchema, z.literal('all')]).optional()
    ),
  })
  .transform((query) => ({
    page: query.page,
    limit: query.limit,
    search: query.search,
    status: query.status ?? 'active',
  }));

export type ListAccessAllowlistQuery = z.infer<
  typeof listAccessAllowlistQuerySchema
>;
