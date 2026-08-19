import { Router } from 'express';
import usersRouter from '../routes/api/users/users.route';
import projectsRouter from '../routes/api/projects/projects.route';
import teamsRouter from '../routes/api/teams/teams.route';
import profileRouter from '../routes/api/profile/profile.route';
import savedViewsRouter from '../routes/api/savedViews/savedViews.route';
import {
  accessAllowlist,
  attachments,
  chat,
  comments,
  health,
  notifications,
  root,
  sprints,
  workItems,
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
routesConfig.use('/api/chat', chat.router);
routesConfig.use('/api/comments', comments.router);
routesConfig.use('/api/notifications', notifications.router);
routesConfig.use('/api/profile', profileRouter);
routesConfig.use('/api/projects', projectsRouter);
routesConfig.use('/api/saved-views', savedViewsRouter);
routesConfig.use('/api/sprints', sprints.router);
routesConfig.use('/api/teams', teamsRouter);
routesConfig.use('/api/users', usersRouter);
routesConfig.use('/api/workItems', workItems.router);

export default routesConfig;
