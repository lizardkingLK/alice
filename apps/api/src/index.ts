import express, { Request, Response } from 'express'
import cors from 'cors'
import { startServer } from './server';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', runtime: 'express' });
});

startServer().then((port) => {
    app.listen(port, () => {
        console.log(`info. API backend actively listening on http://localhost:${port}`);
    });
});