import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { passport } from './lib/auth.js';
import { pool } from './db.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import tripRoutes from './routes/trips.js';
import cityRoutes from './routes/cities.js';
import activityRoutes from './routes/activities.js';
import userRoutes from './routes/users.js';
import communityRoutes from './routes/community.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use(passport.initialize());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'unreachable', detail: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `No route matches ${req.method} ${req.path}` });
});

// One place turns thrown errors into a message the interface can show.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const isDbDown = err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR';
  res.status(isDbDown ? 503 : status).json({
    error: isDbDown
      ? 'The database is not reachable. Run db-start, then db-reset, in the dev shell.'
      : err.message || 'Something went wrong.',
  });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`GlobeTrotter API listening on http://localhost:${port}`);
});
