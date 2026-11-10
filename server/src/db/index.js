// src/db/index.js
// npm i mysql2 dotenv
import 'dotenv/config';
import mysql from 'mysql2/promise';
 
// On Vercel every function instance gets its own pool, and shared MySQL hosting allows only a small
// number of simultaneous connections per user, so keep each pool small and let idle connections go.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
  maxIdle: 2, // idle connections kept open per instance
  idleTimeout: 20000, // ms before an idle connection is closed
  enableKeepAlive: true,
  // Set DB_SSL=true if your MySQL host supports TLS (the connection is then encrypted).
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
});
 
export default pool;