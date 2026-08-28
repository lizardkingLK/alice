import { Router } from 'express';
import {
  accessAllowlist,
  attachments,
  chat,
  comments,
  health,
  jira,
  notifications,
  profile,
  projects,
  root,
  savedViews,
  sprints,
  teams,
  users,
  workItems,
  worklogs,
} from './composition';

const routesConfig: Router = Router();

// Version path map lives here (not composition, not per-route middleware).
// See docs/architecture/API_VERSIONING.md
routesConfig.use('/', root.router);
routesConfig.use('/api/health', health.v1Router);
routesConfig.use('/api/v1/health', health.v1Router);
routesConfig.use('/api/v2/health', health.v2Router);
routesConfig.use('/api/accessAllowlist', accessAllowlist.router);
routesConfig.use('/api/attachments', attachments.router);
routesConfig.use('/api/v1/attachments', attachments.router);
routesConfig.use('/api/chat', chat.router);
routesConfig.use('/api/comments', comments.router);
routesConfig.use('/api/jira', jira.router);
routesConfig.use('/api/notifications', notifications.router);
routesConfig.use('/api/profile', profile.router);
routesConfig.use('/api/v1/profile', profile.router);
routesConfig.use('/api/projects', projects.router);
routesConfig.use('/api/saved-views', savedViews.router);
routesConfig.use('/api/sprints', sprints.router);
routesConfig.use('/api/v1/sprints', sprints.router);
routesConfig.use('/api/teams', teams.router);
routesConfig.use('/api/users', users.router);
routesConfig.use('/api/workItems', workItems.router);
routesConfig.use('/api/v1/workItems', workItems.router);
routesConfig.use('/api/worklogs', worklogs.router);
routesConfig.use('/api/v1/worklogs', worklogs.router);

export default routesConfig;
