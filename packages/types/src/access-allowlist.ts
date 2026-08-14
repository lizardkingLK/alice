import { z } from 'zod';
import { Constants } from './generated/supabase/database.types.js';
import { AccessAllowlistKind } from './generated/prisma/enums.js';

/** Trim, lowercase, and strip a leading `@` from a domain string. */
export function normalizeAccessAllowlistDomain(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('@') ? normalized.slice(1) : normalized;
}

/**
 * Hostname-style domain: requires at least one dot (rejects `fff`, accepts `fff.com`).
 */
export const accessAllowlistDomainValueSchema = z
  .string()
  .min(1, { message: 'Domain is required.' })
  .transform(normalizeAccessAllowlistDomain)
  .refine(
    (domain) =>
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
        domain
      ),
    { message: 'Enter a valid domain (e.g. acme.com).' }
  );

/** Email for allowlist rows — trim + lowercase via pipe, Zod email check. */
export const accessAllowlistEmailValueSchema = z
  .string()
  .trim()
  .min(1, { message: 'Email is required.' })
  .pipe(z.email({ message: 'Please enter a valid email address.' }))
  .transform((value) => value.toLowerCase());

const accessAllowlistStatusSchema = z.enum(Constants.public.Enums.RecordStatus);

const accessAllowlistMetaFields = {
  label: z.string().max(200).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  status: accessAllowlistStatusSchema.optional(),
};

export const accessAllowlistCreateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(AccessAllowlistKind.domain),
    value: accessAllowlistDomainValueSchema,
    ...accessAllowlistMetaFields,
  }),
  z.object({
    kind: z.literal(AccessAllowlistKind.email),
    value: accessAllowlistEmailValueSchema,
    ...accessAllowlistMetaFields,
  }),
]);

export const accessAllowlistUpdateSchema = z.object(accessAllowlistMetaFields);

export type AccessAllowlistCreateInput = z.infer<
  typeof accessAllowlistCreateSchema
>;
export type AccessAllowlistUpdateInput = z.infer<
  typeof accessAllowlistUpdateSchema
>;

export function isValidAccessAllowlistDomain(domain: string): boolean {
  return accessAllowlistDomainValueSchema.safeParse(domain).success;
}
