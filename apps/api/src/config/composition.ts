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
import { WorklogsRepository } from '../routes/api/worklogs/worklogs.repository';
import { WorklogsService } from '../routes/api/worklogs/worklogs.service';
import { createWorklogsRouter } from '../routes/api/worklogs/worklogs.route';
import { AccessAllowlistRepository } from '../routes/api/accessAllowlist/accessAllowlist.repository';
import { AccessAllowlistService } from '../routes/api/accessAllowlist/accessAllowlist.service';
import { createAccessAllowlistRouter } from '../routes/api/accessAllowlist/accessAllowlist.route';
import { AccessRequestsRepository } from '../routes/api/accessRequests/accessRequests.repository';
import { AccessRequestsService } from '../routes/api/accessRequests/accessRequests.service';
import { createAccessRequestsRouter } from '../routes/api/accessRequests/accessRequests.route';
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
import { ProjectsRepository } from '../routes/api/projects/projects.repository';
import { ProjectsService } from '../routes/api/projects/projects.service';
import { createProjectsRouter } from '../routes/api/projects/projects.route';
import { JiraRepository } from '../routes/api/jira/jira.repository';
import { JiraService } from '../routes/api/jira/jira.service';
import { createJiraRouter } from '../routes/api/jira/jira.route';
import { UsersRepository } from '../routes/api/users/users.repository';
import { UsersService } from '../routes/api/users/users.service';
import { createUsersRouter } from '../routes/api/users/users.route';
import { TeamsRepository } from '../routes/api/teams/teams.repository';
import { TeamsService } from '../routes/api/teams/teams.service';
import { createTeamsRouter } from '../routes/api/teams/teams.route';
import { ProfileService } from '../routes/api/profile/profile.service';
import { ProfileRepository } from '../routes/api/profile/profile.repository';
import { createProfileRouter } from '../routes/api/profile/profile.route';
import { SavedViewsRepository } from '../routes/api/savedViews/savedViews.repository';
import { SavedViewsService } from '../routes/api/savedViews/savedViews.service';
import { createSavedViewsRouter } from '../routes/api/savedViews/savedViews.route';
import { IntegrationsRepository } from '../routes/api/integrations/integrations.repository';
import { IntegrationsService } from '../routes/api/integrations/integrations.service';
import { createIntegrationsRouter } from '../routes/api/integrations/integrations.route';

function createRootConfig() {
  const router = createRootRouter();

  return {
    router,
  };
}

function createAccessAllowlistConfig(
  accessRequestsService: AccessRequestsService
) {
  const accessAllowlistRepository = new AccessAllowlistRepository(supabase);
  const accessAllowlistService = new AccessAllowlistService(
    accessAllowlistRepository,
    accessRequestsService
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

function createAccessRequestsConfig() {
  const notificationsRepository = new NotificationsRepository(supabase);
  const accessRequestsRepository = new AccessRequestsRepository();
  const accessRequestsService = new AccessRequestsService(
    accessRequestsRepository,
    notificationsRepository
  );
  const router = createAccessRequestsRouter({ accessRequestsService });

  return {
    accessRequestsRepository,
    accessRequestsService,
    router,
  };
}

function createAttachmentsConfig(
  workItemRepository: Pick<WorkItemRepository, 'requireProjectMember'>
) {
  const attachmentsRepository = new AttachmentsRepository(supabase);
  const attachmentsService = new AttachmentsService(
    attachmentsRepository,
    workItemRepository
  );
  const router = createAttachmentsRouter({
    attachmentsService,
  });

  return {
    attachmentsRepository,
    attachmentsService,
    router,
  };
}

function createWorklogsConfig(
  workItemRepository: Pick<
    WorkItemRepository,
    'requireProjectMember' | 'getById'
  >
) {
  const worklogsRepository = new WorklogsRepository(supabase);
  const worklogsService = new WorklogsService(
    worklogsRepository,
    workItemRepository
  );
  const router = createWorklogsRouter({ worklogsService });

  return {
    worklogsRepository,
    worklogsService,
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

function createNotificationsConfig(
  accessRequestsService: AccessRequestsService
) {
  const notificationsRepository = new NotificationsRepository(supabase);
  const notificationsService = new NotificationsService(
    notificationsRepository
  );
  const router = createNotificationsRouter({
    notificationsService,
    accessRequestsService,
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

function createJiraConfig() {
  const jiraRepository = new JiraRepository();
  const jiraService = new JiraService(jiraRepository);
  const router = createJiraRouter({ jiraService });

  return {
    jiraRepository,
    jiraService,
    router,
  };
}

function createProjectsConfig(
  workItemService: WorkItemService,
  jiraService: JiraService
) {
  const projectsRepository = new ProjectsRepository(supabase);
  const projectsService = new ProjectsService(projectsRepository);
  const router = createProjectsRouter({
    projectsService,
    workItemService,
    jiraService,
  });

  return {
    projectsRepository,
    projectsService,
    router,
  };
}

function createUsersConfig() {
  const usersRepository = new UsersRepository(supabase);
  const usersService = new UsersService(usersRepository, supabase);
  const router = createUsersRouter({ usersService });

  return {
    usersRepository,
    usersService,
    router,
  };
}

function createTeamsConfig() {
  const teamsRepository = new TeamsRepository(supabase);
  const teamsService = new TeamsService(teamsRepository);
  const router = createTeamsRouter({ teamsService });

  return {
    teamsRepository,
    teamsService,
    router,
  };
}

function createProfileConfig() {
  const profileRepository = new ProfileRepository(supabase);
  const profileService = new ProfileService(profileRepository);
  const router = createProfileRouter({ profileService });

  return {
    profileRepository,
    profileService,
    router,
  };
}

function createSavedViewsConfig(
  notificationsRepository: NotificationsRepository
) {
  const savedViewsRepository = new SavedViewsRepository(supabase);
  const savedViewsService = new SavedViewsService(
    savedViewsRepository,
    notificationsRepository
  );
  const router = createSavedViewsRouter({ savedViewsService });

  return {
    savedViewsRepository,
    savedViewsService,
    router,
  };
}

function createChatConfig(
  workItemService: WorkItemService,
  sprintsService: SprintsService,
  projectsService: ProjectsService,
  projectsRepository: ProjectsRepository,
  integrationsService: IntegrationsService
) {
  const chatRepository = new ChatRepository(supabase);
  const chatService = new ChatService({
    chat: chatRepository,
    workItemService,
    sprintsService,
    projectsService,
    projectsRepository,
    integrationsService,
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

function createIntegrationsConfig() {
  const integrationsRepository = new IntegrationsRepository(supabase);
  const integrationsService = new IntegrationsService(integrationsRepository);
  const router = createIntegrationsRouter({ integrationsService });

  return {
    integrationsRepository,
    integrationsService,
    router,
  };
}

/** Production configs graph (repo → service → router). */
export const root = createRootConfig();
export const health = createHealthConfig();
export const accessRequests = createAccessRequestsConfig();
export const accessAllowlist = createAccessAllowlistConfig(
  accessRequests.accessRequestsService
);
export const notifications = createNotificationsConfig(
  accessRequests.accessRequestsService
);
export const workItems = createWorkItemsConfig(
  notifications.notificationsService
);
export const attachments = createAttachmentsConfig(
  workItems.workItemRepository
);
export const comments = createCommentsConfig(
  notifications.notificationsService
);
export const worklogs = createWorklogsConfig(workItems.workItemRepository);
export const sprints = createSprintsConfig();
export const jira = createJiraConfig();
export const projects = createProjectsConfig(
  workItems.workItemService,
  jira.jiraService
);
export const users = createUsersConfig();
export const teams = createTeamsConfig();
export const profile = createProfileConfig();
export const savedViews = createSavedViewsConfig(
  notifications.notificationsRepository
);
export const integrations = createIntegrationsConfig();
export const chat = createChatConfig(
  workItems.workItemService,
  sprints.sprintsService,
  projects.projectsService,
  projects.projectsRepository,
  integrations.integrationsService
);
