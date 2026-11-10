// src/routes/user.js  - data for the user info page
import { Router } from 'express';
import pool from '../db/index.js';
import { HttpError, asyncHandler, num } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { levelFromXp } from '../lib/xp.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [[u]] = await pool.query(
      'SELECT id, username, email, xp, level, cards_seen, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (!u) throw new HttpError(401, 'User not found');

    const [[prog]] = await pool.query(
      'SELECT COUNT(*) AS introduced, COALESCE(SUM(level = 4), 0) AS mastered FROM user_word_progress WHERE user_id = ?',
      [req.userId]
    );
    const [[rev]] = await pool.query(
      'SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS correct FROM reviews WHERE user_id = ?',
      [req.userId]
    );

    const { level, xpIntoLevel, xpForNext } = levelFromXp(num(u.xp));
    const total = num(rev.total);
    res.json({
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.created_at,
        xp: num(u.xp),
        level,
        xpIntoLevel,
        xpForNext,
      },
      stats: {
        cardsSeen: num(u.cards_seen),
        wordsIntroduced: num(prog.introduced),
        wordsMastered: num(prog.mastered),
        totalReviews: total,
        correctReviews: num(rev.correct),
        accuracy: total ? num(rev.correct) / total : null,
      },
    });
  })
);

export default router;