import z from 'zod';

export const githubSettingsSchema = z.object({
  github_owner: z.string().trim().nullable().optional(),
  github_repo: z.string().trim().nullable().optional(),
  github_token: z.string().trim().nullable().optional(),
});
