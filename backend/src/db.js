import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'globetrotter',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: ['DATE', 'DATETIME'],
  timezone: 'Z',
});

/** Run a query and return the rows. */
export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row, or null. */
export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] ?? null;
}

/** Run a write and return the result header (insertId, affectedRows). */
export async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/** Run fn inside a transaction, rolling back on any error. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
