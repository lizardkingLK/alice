import { supabase } from '../lib/supabase';
import { NotificationsService } from '../routes/api/notifications/notifications.service';
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
import { AttachmentsRepository } from '../routes/api/attachments/attachments.repository';
import { AttachmentsService } from '../routes/api/attachments/attachments.service';
import { createAttachmentsRouter } from '../routes/api/attachments/attachments.route';
import { AccessAllowlistRepository } from '../routes/api/accessAllowlist/accessAllowlist.repository';
import { AccessAllowlistService } from '../routes/api/accessAllowlist/accessAllowlist.service';
import { createAccessAllowlistRouter } from '../routes/api/accessAllowlist/accessAllowlist.route';
import { CommentsRepository } from '../routes/api/comments/comments.repository';
import { CommentsService } from '../routes/api/comments/comments.service';
import { createCommentsRouter } from '../routes/api/comments/comments.route';
import { createNotificationsRouter } from '../routes/api/notifications/notifications.route';
import { NotificationsRepository } from '../routes/api/notifications/notifications.repository';
import { HealthRepository } from '../routes/api/health/health.repository';
import {
  HealthService,
  HealthServiceV2,
} from '../routes/api/health/health.service';
import {
  createHealthRouter,
  createHealthV2Router,
} from '../routes/api/health/health.route';
import { createRootRouter } from '../routes';

function createRootConfig() {
  const router = createRootRouter();

  return {
    router,
  };
}

function createAccessAllowlistConfig() {
  const accessAllowlistRepository = new AccessAllowlistRepository(supabase);
  const accessAllowlistService = new AccessAllowlistService(
    accessAllowlistRepository
  );
  const router = createAccessAllowlistRouter({
    accessAllowlistService,
  });

  return {
    accessAllowlistRepository,
    accessAllowlistService,
    router,
  };
}

function createAttachmentsConfig() {
  const attachmentsRepository = new AttachmentsRepository(supabase);
  const attachmentsService = new AttachmentsService(attachmentsRepository);
  const router = createAttachmentsRouter({
    attachmentsService,
  });

  return {
    attachmentsRepository,
    attachmentsService,
    router,
  };
}

function createCommentsConfig(notificationsService: NotificationsService) {
  const commentsRepository = new CommentsRepository(supabase);
  const commentsService = new CommentsService(
    commentsRepository,
    notificationsService
  );
  const router = createCommentsRouter({
    commentsService,
  });

  return {
    commentsRepository,
    commentsService,
    router,
  };
}

function createNotificationsConfig() {
  const notificationsRepository = new NotificationsRepository(supabase);
  const notificationsService = new NotificationsService(
    notificationsRepository
  );
  const router = createNotificationsRouter({
    notificationsService,
  });

  return {
    notificationsRepository,
    notificationsService,
    router,
  };
}

function createWorkItemsConfig(notificationsService: NotificationsService) {
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

function createHealthConfig() {
  const healthRepository = new HealthRepository();
  const healthService = new HealthService(healthRepository);
  const healthServiceV2 = new HealthServiceV2(healthRepository);
  const v1Router = createHealthRouter({ healthService });
  const v2Router = createHealthV2Router({ healthService: healthServiceV2 });

  return {
    healthRepository,
    healthService,
    healthServiceV2,
    v1Router,
    v2Router,
  };
}

/** Production configs graph (repo → service → router). */
export const root = createRootConfig();
export const health = createHealthConfig();
export const accessAllowlist = createAccessAllowlistConfig();
export const attachments = createAttachmentsConfig();
export const notifications = createNotificationsConfig();
export const comments = createCommentsConfig(
  notifications.notificationsService
);
export const workItems = createWorkItemsConfig(
  notifications.notificationsService
);
export const sprints = createSprintsConfig();
export const chat = createChatConfig(
  workItems.workItemService,
  sprints.sprintsService
);
