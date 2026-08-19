import type { Tables } from './generated/supabase/database.types.js';
import type { SprintStatus } from './sprint-status.js';

type DbSprint = Tables<'sprints'>;

/** Camel-case sprint returned from the API / used on the client. */
export type SprintResponse = Pick<DbSprint, 'id' | 'name' | 'goal'> & {
  status: SprintStatus;
  startDate: DbSprint['start_date'];
  endDate: DbSprint['end_date'];
  createdBy: string;
  updatedBy: DbSprint['updated_by'];
  createdAt: DbSprint['created_at'];
  updatedAt: DbSprint['updated_at'];
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

/** A DB sprint row joined with its project relation. */
export type SprintRowWithProject = DbSprint & {
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

/** Map a DB sprint row (snake_case) to the camel-case API response shape. */
export function mapSprintRowToResponse(
  row: SprintRowWithProject
): SprintResponse {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by ?? '',
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          key: row.project.key,
        }
      : null,
  };
}
