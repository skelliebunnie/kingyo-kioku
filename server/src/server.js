// src/index.js  ->  node src/index.js
import 'dotenv/config';
import { createApp } from './app.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Set JWT_SECRET in .env to a random string of at least 32 characters');
}

const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`));