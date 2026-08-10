import { supabase } from '../lib/supabase';
import { notificationsService } from '../routes/api/notifications/notifications.service';
import { WorkItemRepository } from '../routes/api/workItems/workItems.repository';
import { WorkItemService } from '../routes/api/workItems/workItems.service';
import { createWorkItemsRouter } from '../routes/api/workItems/workItems.route';
import {
  SprintsRepository,
  SprintBurndownRepository,
} from '../routes/api/sprints/sprints.repository';
import {
  SprintsService,
  SprintBurndownService,
} from '../routes/api/sprints/sprints.service';
import { createSprintsRouter } from '../routes/api/sprints/sprints.route';
import { ChatRepository } from '../routes/api/chat/chat.repository';
import { ChatService } from '../routes/api/chat/chat.service';
import { createChatRouter } from '../routes/api/chat/chat.route';

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
  const sprintBurndownService = new SprintBurndownService(
    sprintBurndownRepository
  );
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

function createChatConfig(
  workItemService: WorkItemService,
  sprintsService: SprintsService
) {
  const chatRepository = new ChatRepository(supabase);
  const chatService = new ChatService({
    chat: chatRepository,
    workItemService,
    sprintsService,
  });
  const router = createChatRouter({ chatService });

  return {
    chatRepository,
    chatService,
    router,
  };
}

/** Production work-items graph (repo → service → router). */
export const workItems = createWorkItemsConfig();

/** Production sprints graph (repo → service → router). */
export const sprints = createSprintsConfig();

/** Production chat graph (repo → service → router); receives work-items + sprints. */
export const chat = createChatConfig(
  workItems.workItemService,
  sprints.sprintsService
);
