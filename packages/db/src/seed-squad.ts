export const SEED_EMAIL_DOMAIN = 'alice.dev';

export const SEED_SQUAD_MEMBERS = [
  { name: 'Thibaut Courtois', role: 'member' as const },
  { name: 'Andriy Lunin', role: 'member' as const },
  { name: 'Fran González', role: 'member' as const },
  { name: 'Éder Militão', role: 'member' as const },
  { name: 'Antonio Rüdiger', role: 'member' as const },
  { name: 'Ferland Mendy', role: 'member' as const },
  { name: 'Raúl Asencio', role: 'member' as const },
  { name: 'Aurélien Tchouaméni', role: 'member' as const },
  { name: 'Federico Valverde', role: 'member' as const },
  { name: 'Eduardo Camavinga', role: 'member' as const },
  { name: 'Arda Güler', role: 'member' as const },
  { name: 'Jude Bellingham', role: 'member' as const },
  { name: 'Kylian Mbappé', role: 'member' as const },
  { name: 'Vinícius Júnior', role: 'member' as const },
  { name: 'Rodrygo', role: 'member' as const },
  { name: 'Endrick', role: 'member' as const },
  { name: 'Brahim Díaz', role: 'member' as const },
  { name: 'Gonzalo García', role: 'member' as const },
] as const;

function asciiLower(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * `firstname.lastName[0]@alice.dev`, ASCII-folded.
 * Single-token names omit the last-initial segment (`rodrygo@alice.dev`).
 */
export function seedEmailFromName(
  displayName: string,
  domain: string = SEED_EMAIL_DOMAIN
): string {
  const parts = asciiLower(displayName).split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) {
    throw new Error('Cannot derive seed email from an empty name.');
  }

  if (parts.length === 1) {
    return `${first}@${domain}`;
  }

  const lastInitial = parts.at(-1)?.[0];
  if (!lastInitial) {
    return `${first}@${domain}`;
  }

  return `${first}.${lastInitial}@${domain}`;
}

export function squadSeedUsers(): Array<{
  email: string;
  name: string;
  role: 'member';
}> {
  return SEED_SQUAD_MEMBERS.map((member) => ({
    email: seedEmailFromName(member.name),
    name: member.name,
    role: member.role,
  }));
}
