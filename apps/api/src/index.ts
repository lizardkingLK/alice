import express from 'express'
import cors from 'cors'
import detectPort from 'detect-port'

const app = express();
const TARGET_PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', runtime: 'express' });
});

async function startServer() {
    try {
        const availablePort = await detectPort(TARGET_PORT);
        if (availablePort !== TARGET_PORT) {
            console.warn(`warn. target port ${TARGET_PORT} was occupied. shifting to ${availablePort}.`);
        }

        app.listen(availablePort, () => {
            console.log(`info. API backend actively listening on http://localhost:${availablePort}`);
        });
    } catch (error) {
        console.error('error. critical error during API initialization:', error);
        process.exit(1);
    }
}

startServer();