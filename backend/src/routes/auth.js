import { Router } from 'express';
import { one, run } from '../db.js';
import { passport, signToken, hashPassword, publicUser, requireAuth, PUBLIC_USER_COLUMNS } from '../lib/auth.js';
import { wrap, badRequest } from '../lib/helpers.js';

const router = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  wrap(async (req, res) => {
    const { firstName, lastName, email, password, phone, city, country, bio, photoUrl } = req.body ?? {};

    if (!firstName?.trim()) throw badRequest('Enter a first name.');
    if (!EMAIL.test(email ?? '')) throw badRequest('Enter a valid email address.');
    if (!password || password.length < 8) throw badRequest('Use a password of at least 8 characters.');

    const normalized = email.trim().toLowerCase();
    const taken = await one('SELECT id FROM users WHERE email = ?', [normalized]);
    if (taken) throw badRequest('An account already uses that email address.');

    const result = await run(
      `INSERT INTO users (first_name, last_name, email, password_hash, phone, city, country, bio, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName.trim(),
        (lastName ?? '').trim(),
        normalized,
        await hashPassword(password),
        phone || null,
        city || null,
        country || null,
        bio || null,
        photoUrl || null,
      ]
    );

    const user = await one(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [result.insertId]);
    res.status(201).json({ token: signToken(user), user });
  })
);

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Login failed.' });
    res.json({ token: signToken(user), user: publicUser(user) });
  })(req, res, next);
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Password recovery is stubbed: the hackathon build has no mail service.
router.post(
  '/forgot-password',
  wrap(async (req, res) => {
    const { email } = req.body ?? {};
    if (!EMAIL.test(email ?? '')) throw badRequest('Enter a valid email address.');
    res.json({
      message: 'If an account uses that address, a reset link is on its way. Check your inbox in a few minutes.',
    });
  })
);

export default router;
