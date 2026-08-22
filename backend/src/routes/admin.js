import { Router } from 'express';
import { q, one, run } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { wrap, notFound } from '../lib/helpers.js';

const router = Router();
router.use(requireAdmin);

/** Headline numbers plus the series the dashboard charts. */
router.get(
  '/stats',
  wrap(async (_req, res) => {
    const [totals, tripsByMonth, topCities, topActivities, categoryMix, budgets] = await Promise.all([
      one(`SELECT
             (SELECT COUNT(*) FROM users)             AS users,
             (SELECT COUNT(*) FROM trips)             AS trips,
             (SELECT COUNT(*) FROM trip_stops)        AS stops,
             (SELECT COUNT(*) FROM trip_activities)   AS activities,
             (SELECT COUNT(*) FROM trips WHERE is_public = 1) AS shared_trips,
             (SELECT COUNT(*) FROM community_posts)   AS posts`),
      q(`SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS trips
           FROM trips GROUP BY month ORDER BY month`),
      q(`SELECT c.id, c.name, c.country, COUNT(s.id) AS visits
           FROM trip_stops s JOIN cities c ON c.id = s.city_id
          GROUP BY c.id ORDER BY visits DESC, c.name LIMIT 10`),
      q(`SELECT title, COUNT(*) AS times_added, ROUND(AVG(cost)) AS avg_cost
           FROM trip_activities GROUP BY title ORDER BY times_added DESC LIMIT 10`),
      q(`SELECT category, COUNT(*) AS n FROM trip_activities GROUP BY category ORDER BY n DESC`),
      one(`SELECT ROUND(AVG(days)) AS avg_days FROM (
             SELECT DATEDIFF(end_date, start_date) + 1 AS days FROM trips
           ) t`),
    ]);

    res.json({ totals, tripsByMonth, topCities, topActivities, categoryMix, avgTripDays: budgets?.avg_days ?? 0 });
  })
);

/** Manage users: who they are, how much they plan. */
router.get(
  '/users',
  wrap(async (req, res) => {
    const search = req.query.q ? `%${req.query.q}%` : null;
    const users = await q(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.city, u.country, u.role, u.created_at,
              COUNT(DISTINCT t.id) AS trip_count,
              MAX(t.created_at) AS last_trip_at
         FROM users u LEFT JOIN trips t ON t.user_id = u.id
        ${search ? 'WHERE u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?' : ''}
        GROUP BY u.id
        ORDER BY trip_count DESC, u.created_at DESC`,
      search ? [search, search, search] : []
    );
    res.json({ users });
  })
);

router.get(
  '/users/:id/trips',
  wrap(async (req, res) => {
    const user = await one('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) throw notFound('No such user.');
    const trips = await q(
      `SELECT t.id, t.name, t.start_date, t.end_date, t.is_public,
              COUNT(DISTINCT s.id) AS stop_count
         FROM trips t LEFT JOIN trip_stops s ON s.trip_id = t.id
        WHERE t.user_id = ? GROUP BY t.id ORDER BY t.start_date DESC`,
      [req.params.id]
    );
    res.json({ trips });
  })
);

router.patch(
  '/users/:id',
  wrap(async (req, res) => {
    const { role } = req.body ?? {};
    if (!['user', 'admin'].includes(role)) throw notFound('Choose a role of user or admin.');
    await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ updated: true });
  })
);

router.delete(
  '/users/:id',
  wrap(async (req, res) => {
    await run('DELETE FROM users WHERE id = ? AND role <> "admin"', [req.params.id]);
    res.json({ deleted: true });
  })
);

export default router;
