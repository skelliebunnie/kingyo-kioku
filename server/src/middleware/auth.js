// src/middleware/auth.js
import jwt from 'jsonwebtoken';

const COOKIE = 'token';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res, userId) {
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(userId), expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.userId = Number(jwt.verify(token, process.env.JWT_SECRET).sub);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}