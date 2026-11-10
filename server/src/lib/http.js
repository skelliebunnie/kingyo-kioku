// src/lib/http.js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 5 forwards rejected promises itself; this keeps the routes explicit and works on v4 too.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// MySQL returns DECIMAL/SUM() results as strings; coerce.
export const num = (v) => Number(v ?? 0);

export function parseId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`);
  return n;
}