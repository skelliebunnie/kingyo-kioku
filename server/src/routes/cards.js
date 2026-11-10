// src/routes/cards.js  - the flashcard page
import { Router } from 'express';
import pool from '../db/index.js';
import { HttpError, asyncHandler, num } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { getNextCard, submitAnswer, getRecentReviews } from '../services/cards.js';

const router = Router();
router.use(requireAuth);

// Next card, or { card: null, reason } when there is nothing to show.
router.get(
  '/next',
  asyncHandler(async (req, res) => {
    const card = await getNextCard(req.userId);
    if (card) return res.json({ card });
    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM user_active_sets WHERE user_id = ?', [req.userId]);
    res.json({ card: null, reason: num(c) === 0 ? 'no_active_sets' : 'no_words' });
  })
);

// Latest answers, newest first. ?limit=10 (max 20)
router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    res.json({ recent: await getRecentReviews(req.userId, limit) });
  })
);

// Body: { wordId, sentenceId, guess }  (guess = hiragana; katakana is accepted too)
router.post(
  '/answer',
  asyncHandler(async (req, res) => {
    const { wordId, sentenceId, guess } = req.body ?? {};
    if (!Number.isInteger(wordId) || !Number.isInteger(sentenceId)) throw new HttpError(400, 'wordId and sentenceId are required');
    if (typeof guess !== 'string' || guess.trim() === '' || guess.length > 100)
      throw new HttpError(400, 'guess must be a non-empty string of at most 100 characters');
    res.json(await submitAnswer(req.userId, { wordId, sentenceId, guess }));
  })
);

export default router;