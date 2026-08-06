import { supabase } from '../lib/supabase';
import { notificationsService } from '../routes/api/notifications/notifications.service';
import { WorkItemRepository } from '../routes/api/workItems/workItems.repository';
import { WorkItemService } from '../routes/api/workItems/workItems.service';
import { createWorkItemsRouter } from '../routes/api/workItems/workItems.route';
import { SprintsRepository, SprintBurndownRepository } from '../routes/api/sprints/sprints.repository';
import { SprintsService, SprintBurndownService } from '../routes/api/sprints/sprints.service';
import { createSprintsRouter } from '../routes/api/sprints/sprints.route';

function createWorkItemsConfig() {
  const workItemRepository = new WorkItemRepository(supabase);
  const workItemService = new WorkItemService(workItemRepository);
  const router = createWorkItemsRouter({
    workItemService,
    notificationsService,
  });

  return {
    workItemRepository,
    workItemService,
    router,
  };
}

function createSprintsConfig() {
  const sprintsRepository = new SprintsRepository(supabase);
  const sprintBurndownRepository = new SprintBurndownRepository(supabase);
  const sprintsService = new SprintsService(sprintsRepository);
  const sprintBurndownService = new SprintBurndownService(sprintBurndownRepository);
  const router = createSprintsRouter({
    sprintsService,
    sprintBurndownService,
  });

  return {
    sprintsRepository,
    sprintBurndownRepository,
    sprintsService,
    sprintBurndownService,
    router,
  };
}

/** Production work-items graph (repo → service → router). */
export const workItems = createWorkItemsConfig();

/** Production sprints graph (repo → service → router). */
export const sprints = createSprintsConfig();
