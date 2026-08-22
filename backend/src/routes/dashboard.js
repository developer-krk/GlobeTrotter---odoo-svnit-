import { Router } from 'express';
import { q, one } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { wrap, isoDate } from '../lib/helpers.js';
import { listTrips } from '../lib/trips.js';

const router = Router();
router.use(requireAuth);

/** Everything the home screen shows, in one request. */
router.get(
  '/',
  wrap(async (req, res) => {
    const today = isoDate(new Date());
    const trips = await listTrips(req.user.id);

    const ongoing = trips.filter((t) => t.status === 'ongoing');
    const upcoming = trips.filter((t) => t.status === 'upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date));
    const previous = trips.filter((t) => t.status === 'completed');

    // Regions the traveller has not been to yet lead the recommendations.
    const visitedRegions = new Set(
      (
        await q(
          `SELECT DISTINCT c.region FROM trip_stops s
             JOIN cities c ON c.id = s.city_id
             JOIN trips t ON t.id = s.trip_id
            WHERE t.user_id = ?`,
          [req.user.id]
        )
      ).map((r) => r.region)
    );

    const popular = await q(
      `SELECT c.*, COUNT(a.id) AS activity_count
         FROM cities c LEFT JOIN activities a ON a.city_id = c.id
        GROUP BY c.id ORDER BY c.popularity DESC LIMIT 24`
    );
    const recommended = [
      ...popular.filter((c) => !visitedRegions.has(c.region)),
      ...popular.filter((c) => visitedRegions.has(c.region)),
    ].slice(0, 8);

    const byRegion = await q(
      `SELECT region, COUNT(*) AS city_count, ROUND(AVG(cost_index)) AS avg_daily_cost
         FROM cities GROUP BY region ORDER BY city_count DESC`
    );

    const nextTrip = ongoing[0] ?? upcoming[0] ?? null;
    const plannedSpend = trips
      .filter((t) => t.status !== 'completed')
      .reduce((sum, t) => sum + t.budget.total, 0);

    res.json({
      user: req.user,
      today,
      ongoing,
      upcoming: upcoming.slice(0, 4),
      previous: previous.slice(0, 6),
      nextTrip,
      recommended,
      regions: byRegion,
      highlights: {
        tripCount: trips.length,
        plannedSpend,
        countriesPlanned: new Set(trips.flatMap((t) => t.route.map((r) => r.country))).size,
        daysAway: trips.filter((t) => t.status !== 'completed').reduce((sum, t) => sum + t.days, 0),
      },
    });
  })
);

export default router;
