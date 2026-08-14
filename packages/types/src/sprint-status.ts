import { Constants } from './generated/supabase/database.types.js';
import { SprintStatus as PrismaSprintStatus } from './generated/prisma/enums.js';

/** Canonical ordered sprint statuses (matches DB enum). */
export const SPRINT_STATUSES = Constants.public.Enums.SprintStatus;

export type SprintStatus = (typeof SPRINT_STATUSES)[number];

/** PascalCase aliases over generated Prisma enum members. */
export const SprintStatusEnum = {
  Planned: PrismaSprintStatus.planned,
  Active: PrismaSprintStatus.active,
  Closed: PrismaSprintStatus.closed,
  Archived: PrismaSprintStatus.archived,
} as const;
