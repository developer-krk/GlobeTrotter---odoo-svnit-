import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { one } from '../db.js';

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

export const PUBLIC_USER_COLUMNS = `
  id, first_name, last_name, email, phone, city, country, bio,
  photo_url, language, home_currency, role, created_at
`;

/** Verify an email and password pair. Returns the user row or null. */
async function verifyCredentials(email, password) {
  const user = await one('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password', session: false }, async (email, password, done) => {
    try {
      const user = await verifyCredentials(email, password);
      if (!user) return done(null, false, { message: 'That email and password do not match an account.' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.use(
  new JwtStrategy(
    { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET },
    async (payload, done) => {
      try {
        const user = await one(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [payload.sub]);
        return user ? done(null, user) : done(null, false);
      } catch (err) {
        return done(err);
      }
    }
  )
);

export { passport };

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

/** Strip the password hash before a user row leaves the server. */
export function publicUser(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
}

/** Require a valid bearer token. */
export const requireAuth = passport.authenticate('jwt', { session: false });

/** Require a valid bearer token belonging to an admin. */
export const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'This area is for administrators.' });
    }
    next();
  },
];

/** Read the user from a bearer token if one is present, but never reject. */
export function optionalAuth(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    if (user) req.user = user;
    next();
  })(req, res, next);
}
