import { Router } from 'express';
import { one, run, tx, q } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { wrap, notFound, shareSlug } from '../lib/helpers.js';
import { loadTrip } from '../lib/trips.js';

const router = Router();

/** Read-only itinerary behind a share link. No account needed. */
router.get(
  '/trips/:slug',
  wrap(async (req, res) => {
    const row = await one('SELECT id FROM trips WHERE share_slug = ? AND is_public = 1', [req.params.slug]);
    if (!row) throw notFound('This itinerary is private or the link has expired.');
    const trip = await loadTrip(row.id);
    res.json({ trip });
  })
);

/** Trips other travellers have shared, for the explore and community screens. */
router.get(
  '/trips',
  wrap(async (req, res) => {
    const trips = await q(
      `SELECT t.id, t.name, t.description, t.start_date, t.end_date, t.cover_url, t.share_slug,
              CONCAT(u.first_name, ' ', u.last_name) AS owner_name, u.photo_url AS owner_photo,
              COUNT(DISTINCT s.id) AS stop_count,
              GROUP_CONCAT(DISTINCT c.name ORDER BY s.position SEPARATOR ' → ') AS route
         FROM trips t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN trip_stops s ON s.trip_id = t.id
         LEFT JOIN cities c ON c.id = s.city_id
        WHERE t.is_public = 1
        GROUP BY t.id
        ORDER BY t.created_at DESC
        LIMIT ?`,
      [Number(req.query.limit) || 24]
    );
    res.json({ trips });
  })
);

/** Copy a shared itinerary into your own account, dates and all. */
router.post(
  '/trips/:slug/copy',
  requireAuth,
  wrap(async (req, res) => {
    const source = await one('SELECT * FROM trips WHERE share_slug = ? AND is_public = 1', [req.params.slug]);
    if (!source) throw notFound('This itinerary is private or the link has expired.');

    const newId = await tx(async (conn) => {
      const [trip] = await conn.query(
        `INSERT INTO trips (user_id, name, description, start_date, end_date, cover_url, travellers, copied_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          `${source.name} (copy)`,
          source.description,
          source.start_date,
          source.end_date,
          source.cover_url,
          source.travellers,
          source.id,
        ]
      );
      const tripId = trip.insertId;

      const [stops] = await conn.query('SELECT * FROM trip_stops WHERE trip_id = ? ORDER BY position', [source.id]);
      const stopMap = new Map();
      for (const s of stops) {
        const [inserted] = await conn.query(
          'INSERT INTO trip_stops (trip_id, city_id, start_date, end_date, position, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [tripId, s.city_id, s.start_date, s.end_date, s.position, s.notes]
        );
        stopMap.set(s.id, inserted.insertId);
      }

      const [acts] = await conn.query('SELECT * FROM trip_activities WHERE trip_id = ?', [source.id]);
      for (const a of acts) {
        await conn.query(
          `INSERT INTO trip_activities
             (trip_id, stop_id, activity_id, title, category, cost, scheduled_date, start_time, duration_minutes, position, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tripId,
            stopMap.get(a.stop_id),
            a.activity_id,
            a.title,
            a.category,
            a.cost,
            a.scheduled_date,
            a.start_time,
            a.duration_minutes,
            a.position,
            a.notes,
          ]
        );
      }

      const [costs] = await conn.query('SELECT * FROM trip_costs WHERE trip_id = ?', [source.id]);
      for (const c of costs) {
        await conn.query('INSERT INTO trip_costs (trip_id, stop_id, category, label, amount) VALUES (?, ?, ?, ?, ?)', [
          tripId,
          c.stop_id ? stopMap.get(c.stop_id) : null,
          c.category,
          c.label,
          c.amount,
        ]);
      }
      return tripId;
    });

    res.status(201).json({ trip: await loadTrip(newId) });
  })
);

export default router;
