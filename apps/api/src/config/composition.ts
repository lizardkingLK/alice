import { supabase } from '../lib/supabase';
import { notificationsService } from '../routes/api/notifications/notifications.service';
import { WorkItemRepository } from '../routes/api/workItems/workItems.repository';
import { WorkItemService } from '../routes/api/workItems/workItems.service';
import { createWorkItemsRouter } from '../routes/api/workItems/workItems.route';

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

/** Production work-items graph (repo → service → router). */
export const workItems = createWorkItemsConfig();
