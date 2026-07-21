/**
 * Placeholder values for the edit-profile UI scaffold. This page is a visual
 * mock only — nothing here is fetched from or written to Supabase yet.
 */
export const EDIT_PROFILE_MOCK = {
  name: 'Alana Smith',
  handle: 'alana',
  email: 'asmith@acme.com',
  emailVerified: true,
  phone: '+61 422 537 400',
  bio: 'Software engineer focused on developer experience and platform tooling.',
  role: 'member',
  avatarUrl: null as string | null,
  notifications: {
    productUpdates: true,
    mentions: true,
    weeklySummary: false,
  },
} as const;

export const BIO_MAX_LENGTH = 160;
