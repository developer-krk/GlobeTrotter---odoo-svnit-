import { Router } from 'express';
import { q, one, run } from '../db.js';
import { requireAuth, hashPassword, PUBLIC_USER_COLUMNS } from '../lib/auth.js';
import { wrap, badRequest } from '../lib/helpers.js';
import { listTrips } from '../lib/trips.js';

const router = Router();
router.use(requireAuth);

/** Profile screen: the person plus their planned and previous trips. */
router.get(
  '/me',
  wrap(async (req, res) => {
    const trips = await listTrips(req.user.id);
    const saved = await q(
      `SELECT c.* FROM saved_cities s JOIN cities c ON c.id = s.city_id
        WHERE s.user_id = ? ORDER BY s.saved_at DESC`,
      [req.user.id]
    );
    res.json({
      user: req.user,
      planned: trips.filter((t) => t.status !== 'completed'),
      previous: trips.filter((t) => t.status === 'completed'),
      savedCities: saved,
    });
  })
);

router.patch(
  '/me',
  wrap(async (req, res) => {
    const fields = {
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      email: req.body.email && String(req.body.email).trim().toLowerCase(),
      phone: req.body.phone,
      city: req.body.city,
      country: req.body.country,
      bio: req.body.bio,
      photo_url: req.body.photoUrl,
      language: req.body.language,
      home_currency: req.body.homeCurrency,
    };
    const set = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (set.length === 0) throw badRequest('Nothing to update.');

    if (fields.email) {
      const taken = await one('SELECT id FROM users WHERE email = ? AND id <> ?', [fields.email, req.user.id]);
      if (taken) throw badRequest('Another account already uses that email address.');
    }

    await run(`UPDATE users SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`, [
      ...set.map(([, v]) => v),
      req.user.id,
    ]);
    res.json({ user: await one(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [req.user.id]) });
  })
);

router.post(
  '/me/password',
  wrap(async (req, res) => {
    const { password } = req.body ?? {};
    if (!password || password.length < 8) throw badRequest('Use a password of at least 8 characters.');
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(password), req.user.id]);
    res.json({ updated: true });
  })
);

/** Deleting the account removes the trips with it. */
router.delete(
  '/me',
  wrap(async (req, res) => {
    await run('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ deleted: true });
  })
);

export default router;
