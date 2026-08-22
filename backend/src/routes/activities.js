import { Router } from 'express';
import { q } from '../db.js';
import { wrap, pickSort } from '../lib/helpers.js';

const router = Router();

const SORTS = {
  popularity: 'a.popularity DESC, a.name ASC',
  name: 'a.name ASC',
  'cost-low': 'a.cost ASC, a.name ASC',
  'cost-high': 'a.cost DESC, a.name ASC',
  duration: 'a.duration_minutes ASC, a.name ASC',
};

// GET /api/activities?q=&cityId=&category=&maxCost=&maxDuration=&sort=&limit=
router.get(
  '/',
  wrap(async (req, res) => {
    const { q: search, cityId, category, maxCost, maxDuration, sort, limit } = req.query;
    const where = [];
    const params = [];

    if (search) {
      where.push('(a.name LIKE ? OR a.description LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (cityId) { where.push('a.city_id = ?'); params.push(cityId); }
    if (category) { where.push('a.category = ?'); params.push(category); }
    if (maxCost) { where.push('a.cost <= ?'); params.push(Number(maxCost)); }
    if (maxDuration) { where.push('a.duration_minutes <= ?'); params.push(Number(maxDuration)); }

    const rows = await q(
      `SELECT a.*, c.name AS city_name, c.country
         FROM activities a JOIN cities c ON c.id = a.city_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${pickSort(sort, SORTS)}
        LIMIT ?`,
      [...params, Number(limit) || 80]
    );

    res.json({ activities: rows });
  })
);

router.get(
  '/facets',
  wrap(async (_req, res) => {
    const categories = await q(
      'SELECT category, COUNT(*) AS n, ROUND(AVG(cost)) AS avg_cost FROM activities GROUP BY category ORDER BY n DESC'
    );
    res.json({ categories });
  })
);

export default router;
