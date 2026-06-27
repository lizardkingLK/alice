import cors from 'cors';

const allowedOrigins = new Set<string>([
  process.env.FRONTEND_URL || 'http://localhost:3000',
]);

const corsConfig = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('error. blocked by CORS policy'));
    }
  },
  optionsSuccessStatus: 200,
});

export default corsConfig;
