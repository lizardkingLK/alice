import dotenv from "dotenv";
dotenv.config();

import express, { } from 'express'
import cors from 'cors'
import './preload';
// import express from 'express';
// import cors from 'cors';
import { startServer } from './server';
import { notificationsRouter } from "./notifications/notifications.router";
import { clerkMiddleware } from '@clerk/express';
import healthRouter from './routes/api/health';
import usersRouter from './routes/api/users';
import uploadRouter from "./routes/upload";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/notifications", notificationsRouter);

// app.use(clerkMiddleware());

app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);
app.use("/api", uploadRouter);

console.log({a: process.env.PORT, b: process.env.NOVU_SECRET_KEY})

startServer().then((port) => {
  app.listen(port, () => {
    console.log(
      `info. API backend actively listening on http://localhost:${port}`
    );
  });
});
