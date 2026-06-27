import { Router } from 'express';
import filesRouter from '../routes/api/files/files.route';
import usersRouter from '../routes/api/users/users.route';
import healthRouter from '../routes/api/health/health.route';
import notificationsRouter from '../routes/api/notifications/notifications.route';

const routesConfig: Router = Router();

routesConfig.use('/api/health', healthRouter);
routesConfig.use('/api/users', usersRouter);
routesConfig.use('/api/files', filesRouter);
routesConfig.use('/api/notifications', notificationsRouter);

export default routesConfig;
