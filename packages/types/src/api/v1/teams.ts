import { z } from 'zod';
import type { teamsGetPayload } from '../../generated/prisma/models/teams.js';

export const teamManagerSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const teamMemberSelect = {
  team_id: true,
  user_id: true,
  role: true,
  seniority: true,
  capacity: true,
  allocation: true,
  reporting_line: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

export const teamListSelect = {
  id: true,
  name: true,
  description: true,
  manager_id: true,
  project_id: true,
  tech_stack: true,
  status: true,
  created_at: true,
  updated_at: true,
  manager: { select: teamManagerSelect },
  members: { select: teamMemberSelect },
} as const;

export type TeamListRow = teamsGetPayload<{
  select: typeof teamListSelect;
}>;

import { RecordStatus as RecordStatusEnum } from '../../generated/prisma/enums.js';

type RecordStatusType =
  (typeof RecordStatusEnum)[keyof typeof RecordStatusEnum];

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

export const listTeamsQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined || value === '' ? 1 : value),
    z.coerce.number().int().min(1)
  ),
  limit: z.preprocess(
    (value) => (value === undefined || value === '' ? 10 : value),
    z.coerce.number().int().min(1).max(100)
  ),
  status: z.preprocess(
    emptyToUndefined,
    z
      .enum(
        Object.values(RecordStatusEnum) as [
          RecordStatusType,
          ...RecordStatusType[],
        ]
      )
      .optional()
  ),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
