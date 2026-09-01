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

export const allowedProjectIdsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return null;
    if (Array.isArray(val)) {
      const filtered = val.map((v) => v.trim()).filter(Boolean);
      return filtered.length > 0 ? filtered : null;
    }
    const parts = val
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : null;
  });

const accessAllowlistMetaFields = {
  label: z.string().max(200).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  allowed_project_ids: allowedProjectIdsSchema,
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

export const OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE =
  'You cannot delete or deactivate the domain that matches your email.';

/** Domain part of an email (`User@Acme.COM` → `acme.com`). */
export function emailDomainFromAddress(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return null;
  }

  const local = parts[0];
  const domain = parts[1];
  if (!local || !domain) {
    return null;
  }

  return domain;
}

/** True when the row is a domain rule for the actor's own email domain. */
export function isActorOwnAllowlistDomain(
  entry: { kind: string; value: string },
  actorEmail: string | null | undefined
): boolean {
  if (entry.kind !== 'domain' || !actorEmail) {
    return false;
  }

  const actorDomain = emailDomainFromAddress(actorEmail);
  if (!actorDomain) {
    return false;
  }

  return normalizeAccessAllowlistDomain(entry.value) === actorDomain;
}

/** True when deleting or setting a non-active status on the actor's own domain. */
export function isOwnAllowlistDomainLockout(params: {
  readonly entry: { kind: string; value: string };
  readonly actorEmail?: string | null;
  readonly deleting?: boolean;
  readonly nextStatus?: string | null;
}): boolean {
  if (!isActorOwnAllowlistDomain(params.entry, params.actorEmail)) {
    return false;
  }

  if (params.deleting) {
    return true;
  }

  return (
    params.nextStatus != null &&
    params.nextStatus !== '' &&
    params.nextStatus !== 'active'
  );
}
