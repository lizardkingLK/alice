/** Reserved sprint name — UI uses "Backlog" for unscheduled work (`sprint_id` null). */
export const RESERVED_SPRINT_NAME = 'backlog';

export function isReservedSprintName(name: string): boolean {
  return name.trim().toLowerCase() === RESERVED_SPRINT_NAME;
}
