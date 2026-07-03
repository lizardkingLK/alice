import express, { RequestHandler } from 'express';

const jsonConfig: RequestHandler = express.json({ limit: '50mb' });

export default jsonConfig;
