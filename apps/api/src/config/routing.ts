import { Router } from 'express';
import attachmentsRouter from '@/routes/api/attachments/attachments.route';
import usersRouter from '@/routes/api/users/users.route';
import healthRouter from '@/routes/health.route';
import notificationsRouter from '@/routes/api/notifications/notifications.route';
import sprintsRouter from '@/routes/api/sprints/sprints.route';
import projectsRouter from '@/routes/api/projects/projects.route';
import workItemsRouter from '@/routes/api/workItems/workItems.route';
import teamsRouter from '@/routes/api/teams/teams.route';
import commentsRouter from '@/routes/api/comments/comments.route';
import profileRouter from '@/routes/api/profile/profile.route';
import accessAllowlistRouter from '@/routes/api/accessAllowlist/accessAllowlist.route';

const routesConfig: Router = Router();

routesConfig.use('/', healthRouter);
routesConfig.use('/api/attachments', attachmentsRouter);
routesConfig.use('/api/comments', commentsRouter);
routesConfig.use('/api/notifications', notificationsRouter);
routesConfig.use('/api/profile', profileRouter);
routesConfig.use('/api/projects', projectsRouter);
routesConfig.use('/api/sprints', sprintsRouter);
routesConfig.use('/api/teams', teamsRouter);
routesConfig.use('/api/users', usersRouter);
routesConfig.use('/api/workItems', workItemsRouter);
routesConfig.use('/api/accessAllowlist', accessAllowlistRouter);

export default routesConfig;
