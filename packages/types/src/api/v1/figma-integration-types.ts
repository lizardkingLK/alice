import { z } from 'zod';

export const figmaConnectionStatusSchema = z.object({
  project_id: z.uuid(),
  connected: z.boolean(),
  figma_user_id: z.string().nullable(),
  scopes: z.string().nullable(),
  expires_at: z.string().nullable(),
  authorized_by_user_id: z.uuid().nullable(),
  authorized_by_name: z.string().nullable(),
  design_access_verified: z.boolean(),
  verified_file_key: z.string().nullable(),
  verified_file_name: z.string().nullable(),
  verified_at: z.string().nullable(),
  verification_error: z.string().nullable(),
});

export type FigmaConnectionStatusDto = z.infer<
  typeof figmaConnectionStatusSchema
>;

export const figmaConnectionResponseSchema = z.object({
  connection: figmaConnectionStatusSchema,
});
export type FigmaConnectionResponse = z.infer<
  typeof figmaConnectionResponseSchema
>;

export const figmaOAuthStartResponseSchema = z.object({ url: z.url() });
export type FigmaOAuthStartResponse = z.infer<
  typeof figmaOAuthStartResponseSchema
>;
