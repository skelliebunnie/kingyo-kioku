// src/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import pool from '../db/index.js';
import { HttpError, asyncHandler } from '../lib/http.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

const router = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the account doesn't exist, so response time doesn't reveal that.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post(
  '/register',
  limiter,
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body ?? {};
    if (typeof username !== 'string' || !USERNAME_RE.test(username))
      throw new HttpError(400, 'Username must be 3-30 letters, numbers or underscores');
    if (typeof email !== 'string' || email.length > 255 || !EMAIL_RE.test(email))
      throw new HttpError(400, 'Enter a valid email address');
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
      throw new HttpError(400, 'Password must be 8-72 characters');

    const hash = await bcrypt.hash(password, 10);
    let userId;
    try {
      const [r] = await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [
        username,
        email,
        hash,
      ]);
      userId = r.insertId;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Username or email is already in use');
      throw err;
    }

    // Start new users on the easiest system set (the first one created).
    const [[first]] = await pool.query("SELECT id FROM sets WHERE kind = 'system' ORDER BY id LIMIT 1");
    if (first) await pool.query('INSERT IGNORE INTO user_active_sets (user_id, set_id) VALUES (?, ?)', [userId, first.id]);

    setAuthCookie(res, userId);
    res.status(201).json({ user: { id: userId, username } });
  })
);

router.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body ?? {};
    if (typeof identifier !== 'string' || typeof password !== 'string')
      throw new HttpError(400, 'Username/email and password are required');

    const [[user]] = await pool.query('SELECT id, username, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1', [
      identifier,
      identifier,
    ]);
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Incorrect username/email or password');

    setAuthCookie(res, user.id);
    res.json({ user: { id: user.id, username: user.username } });
  })
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;