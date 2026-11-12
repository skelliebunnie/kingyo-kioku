// src/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { HttpError } from './lib/http.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import setsRouter from './routes/sets.js';
import cardsRouter from './routes/cards.js';
import progressRouter from './routes/progress.js';

export function createApp() {
  const app = express();

  app.set("trust proxy", "loopback");
  if (process.env.CLIENT_ORIGIN) {
    app.use(cors({ origin: process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim()), credentials: true }));
  }
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'API Running'
    });
  });
  
  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/sets', setsRouter);
  app.use('/api/cards', cardsRouter);
  app.use('/api/progress', progressRouter);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}