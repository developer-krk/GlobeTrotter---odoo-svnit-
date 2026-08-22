import { Router } from 'express';
import { q, one, run } from '../db.js';
import { requireAuth, optionalAuth } from '../lib/auth.js';
import { wrap, badRequest, notFound, pickSort } from '../lib/helpers.js';

const router = Router();

const SORTS = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  liked: 'like_count DESC, p.created_at DESC',
};

// GET /api/community?q=&cityId=&sort=
router.get(
  '/',
  optionalAuth,
  wrap(async (req, res) => {
    const { q: search, cityId, sort } = req.query;
    const where = [];
    const params = [];

    if (search) {
      where.push('(p.title LIKE ? OR p.body LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (cityId) { where.push('p.city_id = ?'); params.push(cityId); }

    const posts = await q(
      `SELECT p.*,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name,
              u.photo_url AS author_photo,
              c.name AS city_name, c.country,
              t.share_slug, t.name AS trip_name, t.is_public,
              COUNT(DISTINCT l.user_id) AS like_count,
              SUM(l.user_id = ?) AS liked_by_me
         FROM community_posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN cities c ON c.id = p.city_id
         LEFT JOIN trips t ON t.id = p.trip_id
         LEFT JOIN post_likes l ON l.post_id = p.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        GROUP BY p.id
        ORDER BY ${pickSort(sort, SORTS)}
        LIMIT 60`,
      [req.user?.id ?? 0, ...params]
    );

    res.json({ posts });
  })
);

router.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const { title, body, tripId, cityId } = req.body ?? {};
    if (!title?.trim()) throw badRequest('Give the post a title.');
    if (!body?.trim()) throw badRequest('Write something to share.');

    const result = await run(
      'INSERT INTO community_posts (user_id, trip_id, city_id, title, body) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, tripId || null, cityId || null, title.trim(), body.trim()]
    );
    res.status(201).json({ id: result.insertId });
  })
);

router.post(
  '/:id/like',
  requireAuth,
  wrap(async (req, res) => {
    const post = await one('SELECT id FROM community_posts WHERE id = ?', [req.params.id]);
    if (!post) throw notFound('That post is gone.');

    const existing = await one('SELECT 1 AS x FROM post_likes WHERE post_id = ? AND user_id = ?', [
      post.id,
      req.user.id,
    ]);
    if (existing) {
      await run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [post.id, req.user.id]);
    } else {
      await run('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [post.id, req.user.id]);
    }

    const count = await one('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?', [post.id]);
    res.json({ liked: !existing, likeCount: count.n });
  })
);

router.delete(
  '/:id',
  requireAuth,
  wrap(async (req, res) => {
    await run('DELETE FROM community_posts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ deleted: true });
  })
);

export default router;
