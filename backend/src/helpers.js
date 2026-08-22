import crypto from 'node:crypto';

/** Wrap an async route so rejected promises reach the error handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** An error that carries an HTTP status code. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const forbidden = (msg = 'You do not have access to this.') => new HttpError(403, msg);

/** A short, URL-safe id used for share links. */
export function shareSlug() {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

/** 'YYYY-MM-DD' for a Date or a date-like string. */
export function isoDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

/** Every date from start to end, inclusive, as 'YYYY-MM-DD'. */
export function eachDate(start, end) {
  const out = [];
  const cursor = new Date(`${isoDate(start)}T00:00:00Z`);
  const last = new Date(`${isoDate(end)}T00:00:00Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Whole days from start to end, inclusive. */
export function dayCount(start, end) {
  const a = new Date(`${isoDate(start)}T00:00:00Z`);
  const b = new Date(`${isoDate(end)}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** 'upcoming' | 'ongoing' | 'completed' for a date range. */
export function tripStatus(start, end, today = isoDate(new Date())) {
  if (isoDate(end) < today) return 'completed';
  if (isoDate(start) > today) return 'upcoming';
  return 'ongoing';
}

/** Pick an allowed sort column, falling back to the first one. */
export function pickSort(requested, allowed) {
  return allowed[requested] ?? Object.values(allowed)[0];
}
