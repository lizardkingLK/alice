'use server';

import { getSprintBurndownServer } from '@/app/sprints/_services/sprints.reads.burndown.server';

export async function loadSprintBurndownAction(sprintId: string) {
  return getSprintBurndownServer(sprintId);
}
