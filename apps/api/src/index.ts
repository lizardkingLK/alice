import './utils/preload';

import express from 'express';
import cors from 'cors';
import { startServer } from './utils/server';

// routes
import healthRouter from './routes/api/health/health.route';
import usersRouter from './routes/api/users/users.route';
import uploadRouter from './routes/api/files/files.route';
import notificationsRouter from './routes/api/notifications/notifications.route';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/files', uploadRouter);
app.use('/api/notifications', notificationsRouter);

startServer().then((port) => {
  app.listen(port, () => {
    console.log(
      `info. API backend actively listening on http://localhost:${port}`
    );
  });
});
