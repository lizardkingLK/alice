import { Constants } from './generated/supabase/database.types.js';

/** Canonical ordered sprint statuses (matches DB enum). */
export const SPRINT_STATUSES = Constants.public.Enums.SprintStatus;

export type SprintStatus = (typeof SPRINT_STATUSES)[number];
