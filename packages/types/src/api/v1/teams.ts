import { z } from 'zod';
import type { teamsGetPayload } from '../../generated/prisma/models/teams.js';

export const createTeamSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().nullable().optional(),
  manager_id: z.uuid({ message: 'Please select a valid manager.' }),
  project_id: z.uuid({ message: 'Please select a valid project.' }),
  tech_stack: z.string().nullable().optional(),
  status: z
    .enum(['active', 'inactive', 'archived', 'deleted'])
    .default('active'),
  member_ids: z.array(z.uuid()).optional(),
  members: z
    .array(
      z.object({
        user_id: z.uuid(),
        capacity: z.number().int().min(0).nullable().optional(),
        allocation: z.number().int().min(0).max(100).nullable().optional(),
      })
    )
    .optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

/** Raw team-member patch fields, exported so callers can extend before refining. */
export const teamMemberPatchFields = {
  capacity: z
    .number()
    .int({ message: 'Capacity must be a whole number.' })
    .min(0, { message: 'Capacity must be at least 0.' })
    .nullable()
    .optional(),
  allocation: z
    .number()
    .int({ message: 'Allocation must be a whole number.' })
    .min(0, { message: 'Allocation must be at least 0.' })
    .max(100, { message: 'Allocation must be at most 100.' })
    .nullable()
    .optional(),
};

export const updateTeamMemberSchema = z
  .object(teamMemberPatchFields)
  .refine((d) => d.capacity !== undefined || d.allocation !== undefined, {
    message: 'At least one of capacity or allocation must be provided.',
  });

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
import { emptyToUndefined } from './query-preprocess.js';

type RecordStatusType =
  (typeof RecordStatusEnum)[keyof typeof RecordStatusEnum];

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
