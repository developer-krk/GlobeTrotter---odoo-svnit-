import { Router } from 'express';
import { q, one, run, tx } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { wrap, badRequest, notFound, shareSlug, isoDate, dayCount } from '../lib/helpers.js';
import { loadTrip, listTrips, ownedTrip } from '../lib/trips.js';

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------- trips

router.get(
  '/',
  wrap(async (req, res) => {
    const trips = await listTrips(req.user.id);
    const { status, q: search } = req.query;

    let filtered = trips;
    if (status && status !== 'all') filtered = filtered.filter((t) => t.status === status);
    if (search) {
      const needle = String(search).toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          (t.description ?? '').toLowerCase().includes(needle) ||
          t.route.some((r) => r.city.toLowerCase().includes(needle))
      );
    }

    res.json({
      trips: filtered,
      counts: {
        all: trips.length,
        ongoing: trips.filter((t) => t.status === 'ongoing').length,
        upcoming: trips.filter((t) => t.status === 'upcoming').length,
        completed: trips.filter((t) => t.status === 'completed').length,
      },
    });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const { name, description, startDate, endDate, coverUrl, travellers } = req.body ?? {};
    if (!name?.trim()) throw badRequest('Give the trip a name.');
    if (!startDate || !endDate) throw badRequest('Choose a start date and an end date.');
    if (endDate < startDate) throw badRequest('The end date must come after the start date.');

    const result = await run(
      `INSERT INTO trips (user_id, name, description, start_date, end_date, cover_url, travellers)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name.trim(), description || null, startDate, endDate, coverUrl || null, Number(travellers) || 1]
    );
    res.status(201).json({ trip: await loadTrip(result.insertId) });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    await ownedTrip(req.params.id, req.user.id);
    res.json({ trip: await loadTrip(req.params.id) });
  })
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    await ownedTrip(req.params.id, req.user.id);
    const fields = {
      name: req.body.name,
      description: req.body.description,
      start_date: req.body.startDate,
      end_date: req.body.endDate,
      cover_url: req.body.coverUrl,
      travellers: req.body.travellers,
    };
    const set = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (set.length === 0) throw badRequest('Nothing to update.');

    await run(
      `UPDATE trips SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...set.map(([, v]) => v), req.params.id]
    );
    res.json({ trip: await loadTrip(req.params.id) });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    await ownedTrip(req.params.id, req.user.id);
    await run('DELETE FROM trips WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  })
);

// ---------------------------------------------------------------- stops

router.post(
  '/:id/stops',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const { cityId, startDate, endDate, notes } = req.body ?? {};
    if (!cityId) throw badRequest('Choose a city for this stop.');

    const city = await one('SELECT id FROM cities WHERE id = ?', [cityId]);
    if (!city) throw badRequest('That city is not in the catalogue.');

    const last = await one('SELECT MAX(position) AS p FROM trip_stops WHERE trip_id = ?', [trip.id]);
    const position = (last?.p ?? -1) + 1;

    // Default to the day after the previous stop ends, or the trip start.
    const previous = await one(
      'SELECT end_date FROM trip_stops WHERE trip_id = ? ORDER BY position DESC LIMIT 1',
      [trip.id]
    );
    const fallbackStart = previous ? isoDate(previous.end_date) : isoDate(trip.start_date);
    const start = startDate || fallbackStart;

    // Default to a two-night stay, shortened to whatever is left of the trip.
    const suggested = new Date(`${start}T00:00:00Z`);
    suggested.setUTCDate(suggested.getUTCDate() + 2);
    const defaultEnd = [isoDate(suggested), isoDate(trip.end_date)]
      .filter((d) => d >= start)
      .sort()[0] ?? start;
    const end = endDate || defaultEnd;
    if (end < start) throw badRequest('The stop cannot end before it starts.');

    const result = await run(
      'INSERT INTO trip_stops (trip_id, city_id, start_date, end_date, position, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [trip.id, cityId, start, end, position, notes || null]
    );
    res.status(201).json({ stopId: result.insertId, trip: await loadTrip(trip.id) });
  })
);

router.patch(
  '/:id/stops/:stopId',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const fields = {
      city_id: req.body.cityId,
      start_date: req.body.startDate,
      end_date: req.body.endDate,
      notes: req.body.notes,
    };
    const set = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (set.length === 0) throw badRequest('Nothing to update.');

    await run(
      `UPDATE trip_stops SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ? AND trip_id = ?`,
      [...set.map(([, v]) => v), req.params.stopId, trip.id]
    );
    res.json({ trip: await loadTrip(trip.id) });
  })
);

router.delete(
  '/:id/stops/:stopId',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    await run('DELETE FROM trip_stops WHERE id = ? AND trip_id = ?', [req.params.stopId, trip.id]);
    res.json({ trip: await loadTrip(trip.id) });
  })
);

// Body: { order: [stopId, stopId, ...] }
router.post(
  '/:id/stops/reorder',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const order = req.body?.order;
    if (!Array.isArray(order)) throw badRequest('Send the stop ids in their new order.');

    await tx(async (conn) => {
      for (const [index, stopId] of order.entries()) {
        await conn.query('UPDATE trip_stops SET position = ? WHERE id = ? AND trip_id = ?', [index, stopId, trip.id]);
      }
    });
    res.json({ trip: await loadTrip(trip.id) });
  })
);

// ---------------------------------------------------------------- activities

router.post(
  '/:id/stops/:stopId/activities',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const stop = await one('SELECT * FROM trip_stops WHERE id = ? AND trip_id = ?', [req.params.stopId, trip.id]);
    if (!stop) throw notFound('That stop is not on this trip.');

    let { activityId, title, category, cost, scheduledDate, startTime, durationMinutes, notes } = req.body ?? {};

    // Adding from the catalogue fills in the details for you.
    if (activityId) {
      const source = await one('SELECT * FROM activities WHERE id = ?', [activityId]);
      if (!source) throw badRequest('That activity is not in the catalogue.');
      title ??= source.name;
      category ??= source.category;
      cost ??= source.cost;
      durationMinutes ??= source.duration_minutes;
    }
    if (!title?.trim()) throw badRequest('Give the activity a name.');

    const date = scheduledDate || isoDate(stop.start_date);
    const last = await one(
      'SELECT MAX(position) AS p FROM trip_activities WHERE stop_id = ? AND scheduled_date = ?',
      [stop.id, date]
    );

    const result = await run(
      `INSERT INTO trip_activities
         (trip_id, stop_id, activity_id, title, category, cost, scheduled_date, start_time, duration_minutes, position, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.id,
        stop.id,
        activityId || null,
        title.trim(),
        category || 'sightseeing',
        Number(cost) || 0,
        date,
        startTime || null,
        Number(durationMinutes) || 60,
        (last?.p ?? -1) + 1,
        notes || null,
      ]
    );
    res.status(201).json({ activityId: result.insertId, trip: await loadTrip(trip.id) });
  })
);

router.patch(
  '/:id/activities/:activityId',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const fields = {
      title: req.body.title,
      category: req.body.category,
      cost: req.body.cost,
      scheduled_date: req.body.scheduledDate,
      start_time: req.body.startTime,
      duration_minutes: req.body.durationMinutes,
      position: req.body.position,
      stop_id: req.body.stopId,
      notes: req.body.notes,
    };
    const set = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (set.length === 0) throw badRequest('Nothing to update.');

    await run(
      `UPDATE trip_activities SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ? AND trip_id = ?`,
      [...set.map(([, v]) => v), req.params.activityId, trip.id]
    );
    res.json({ trip: await loadTrip(trip.id) });
  })
);

router.delete(
  '/:id/activities/:activityId',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    await run('DELETE FROM trip_activities WHERE id = ? AND trip_id = ?', [req.params.activityId, trip.id]);
    res.json({ trip: await loadTrip(trip.id) });
  })
);

// Body: { date, order: [activityId, ...] } — used by drag-to-reorder.
router.post(
  '/:id/activities/reorder',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const { order, date, stopId } = req.body ?? {};
    if (!Array.isArray(order)) throw badRequest('Send the activity ids in their new order.');

    await tx(async (conn) => {
      for (const [index, id] of order.entries()) {
        const set = ['position = ?'];
        const params = [index];
        if (date) { set.push('scheduled_date = ?'); params.push(date); }
        if (stopId) { set.push('stop_id = ?'); params.push(stopId); }
        await conn.query(`UPDATE trip_activities SET ${set.join(', ')} WHERE id = ? AND trip_id = ?`, [
          ...params,
          id,
          trip.id,
        ]);
      }
    });
    res.json({ trip: await loadTrip(trip.id) });
  })
);

// ---------------------------------------------------------------- costs

router.post(
  '/:id/costs',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const { category, label, amount, stopId } = req.body ?? {};
    if (!['transport', 'stay', 'meals', 'other'].includes(category)) throw badRequest('Choose a cost category.');
    if (!label?.trim()) throw badRequest('Give the cost a label.');

    await run('INSERT INTO trip_costs (trip_id, stop_id, category, label, amount) VALUES (?, ?, ?, ?, ?)', [
      trip.id,
      stopId || null,
      category,
      label.trim(),
      Number(amount) || 0,
    ]);
    res.status(201).json({ trip: await loadTrip(trip.id) });
  })
);

router.delete(
  '/:id/costs/:costId',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    await run('DELETE FROM trip_costs WHERE id = ? AND trip_id = ?', [req.params.costId, trip.id]);
    res.json({ trip: await loadTrip(trip.id) });
  })
);

// ---------------------------------------------------------------- sharing

router.post(
  '/:id/share',
  wrap(async (req, res) => {
    const trip = await ownedTrip(req.params.id, req.user.id);
    const makePublic = req.body?.isPublic !== false;
    const slug = trip.share_slug || shareSlug();

    await run('UPDATE trips SET is_public = ?, share_slug = ? WHERE id = ?', [makePublic ? 1 : 0, slug, trip.id]);
    res.json({ isPublic: makePublic, slug });
  })
);

// ---------------------------------------------------------------- calendar

// GET /api/trips/calendar/month?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get(
  '/calendar/range',
  wrap(async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) throw badRequest('Send a from date and a to date.');

    const [trips, activities] = await Promise.all([
      q(
        `SELECT id, name, start_date, end_date, cover_url FROM trips
          WHERE user_id = ? AND start_date <= ? AND end_date >= ?
          ORDER BY start_date`,
        [req.user.id, to, from]
      ),
      q(
        `SELECT a.*, c.name AS city_name, t.name AS trip_name
           FROM trip_activities a
           JOIN trips t ON t.id = a.trip_id
           JOIN trip_stops s ON s.id = a.stop_id
           JOIN cities c ON c.id = s.city_id
          WHERE t.user_id = ? AND a.scheduled_date BETWEEN ? AND ?
          ORDER BY a.scheduled_date, a.position`,
        [req.user.id, from, to]
      ),
    ]);

    res.json({
      trips: trips.map((t) => ({
        ...t,
        start_date: isoDate(t.start_date),
        end_date: isoDate(t.end_date),
        days: dayCount(t.start_date, t.end_date),
      })),
      activities: activities.map((a) => ({ ...a, scheduled_date: isoDate(a.scheduled_date) })),
    });
  })
);

export default router;
