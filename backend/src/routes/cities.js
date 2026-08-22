import { Router } from 'express';
import { q, one, run } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { wrap, pickSort, notFound } from '../lib/helpers.js';

const router = Router();

const SORTS = {
  popularity: 'c.popularity DESC, c.name ASC',
  name: 'c.name ASC',
  'cost-low': 'c.cost_index ASC, c.name ASC',
  'cost-high': 'c.cost_index DESC, c.name ASC',
  country: 'c.country ASC, c.name ASC',
};

// GET /api/cities?q=&country=&region=&maxCost=&sort=&limit=
router.get(
  '/',
  wrap(async (req, res) => {
    const { q: search, country, region, maxCost, sort, limit } = req.query;
    const where = [];
    const params = [];

    if (search) {
      where.push('(c.name LIKE ? OR c.country LIKE ? OR c.region LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (country) { where.push('c.country = ?'); params.push(country); }
    if (region) { where.push('c.region = ?'); params.push(region); }
    if (maxCost) { where.push('c.cost_index <= ?'); params.push(Number(maxCost)); }

    const rows = await q(
      `SELECT c.*, COUNT(a.id) AS activity_count
         FROM cities c
         LEFT JOIN activities a ON a.city_id = c.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY c.id
        ORDER BY ${pickSort(sort, SORTS)}
        LIMIT ?`,
      [...params, Number(limit) || 60]
    );

    res.json({ cities: rows });
  })
);

// The filter menus are built from what is actually in the table.
router.get(
  '/facets',
  wrap(async (_req, res) => {
    const [countries, regions, range] = await Promise.all([
      q('SELECT country, COUNT(*) AS n FROM cities GROUP BY country ORDER BY country'),
      q('SELECT region, COUNT(*) AS n FROM cities GROUP BY region ORDER BY region'),
      one('SELECT MIN(cost_index) AS min, MAX(cost_index) AS max FROM cities'),
    ]);
    res.json({ countries, regions, costRange: range });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const city = await one('SELECT * FROM cities WHERE id = ?', [req.params.id]);
    if (!city) throw notFound('That city is not in the catalogue.');
    const activities = await q(
      'SELECT * FROM activities WHERE city_id = ? ORDER BY popularity DESC, name ASC',
      [city.id]
    );
    res.json({ city, activities });
  })
);

// ---------------------------------------------------------------- saved list

router.get(
  '/saved/mine',
  requireAuth,
  wrap(async (req, res) => {
    const cities = await q(
      `SELECT c.*, s.saved_at
         FROM saved_cities s JOIN cities c ON c.id = s.city_id
        WHERE s.user_id = ? ORDER BY s.saved_at DESC`,
      [req.user.id]
    );
    res.json({ cities });
  })
);

router.post(
  '/:id/save',
  requireAuth,
  wrap(async (req, res) => {
    await run('INSERT IGNORE INTO saved_cities (user_id, city_id) VALUES (?, ?)', [req.user.id, req.params.id]);
    res.status(201).json({ saved: true });
  })
);

router.delete(
  '/:id/save',
  requireAuth,
  wrap(async (req, res) => {
    await run('DELETE FROM saved_cities WHERE user_id = ? AND city_id = ?', [req.user.id, req.params.id]);
    res.json({ saved: false });
  })
);

export default router;
