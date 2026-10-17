import type { Tables } from '@repo/types';

export type SavedView = Tables<'saved_views'>;

export type GetSavedViewsPaginatedResponse = {
  readonly views: SavedView[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
};
