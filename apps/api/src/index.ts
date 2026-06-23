import './preload';
import express from 'express';
import cors from 'cors';
import { startServer } from './server';
import { clerkMiddleware } from '@clerk/express';
import healthRouter from './routes/api/health';
import usersRouter from './routes/api/users';

const app = express();

app.use(cors());
app.use(express.json());

app.use(clerkMiddleware());

app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);

startServer().then((port) => {
  app.listen(port, () => {
    console.log(
      `info. API backend actively listening on http://localhost:${port}`
    );
  });
});