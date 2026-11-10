// server/db/migrate.js  ->  node db/migrate.js
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '../../.env')});
const sql = await fs.readFile(path.join(here, 'schema.sql'), 'utf8');

// Separate connection: multipleStatements is needed to run the whole file,
// and we don't want it enabled on the app's pool.
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  multipleStatements: true,
});

await conn.query(sql);
console.log('Schema applied.');
await conn.end();