import { Router } from 'express';
import filesRouter from '../routes/api/files/files.route';
import usersRouter from '../routes/api/users/users.route';
import healthRouter from '../routes/api/health/health.route';
import notificationsRouter from '../routes/api/notifications/notifications.route';
import sprintsRouter from '../routes/api/sprints/sprints.route';
import projectsRouter from '../routes/api/projects/projects.route';
import attributesRouter from '../routes/api/attributes/attributes.route';
import teamsRouter from '../routes/api/teams/teams.route';

const routesConfig: Router = Router();

routesConfig.use('/', healthRouter);
routesConfig.use('/api/attributes', attributesRouter);
routesConfig.use('/api/files', filesRouter);
routesConfig.use('/api/notifications', notificationsRouter);
routesConfig.use('/api/projects', projectsRouter);
routesConfig.use('/api/sprints', sprintsRouter);
routesConfig.use('/api/users', usersRouter);
routesConfig.use('/api/teams', teamsRouter);

export default routesConfig;
