// src/index.js  ->  node src/index.js
import 'dotenv/config';
import { createApp } from './app.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Set JWT_SECRET in .env to a random string of at least 32 characters');
}

const port = Number(process.env.PORT) || 3000;
// On the server set HOST=127.0.0.1 so only Apache (on the same machine) can reach the API.
// Unset (local development) it listens on all interfaces, so Vite's proxy can use localhost or 127.0.0.1.
const host = process.env.HOST || undefined;
createApp().listen(port, host, () => console.log(`API listening on ${host ?? 'all interfaces'}:${port}`));