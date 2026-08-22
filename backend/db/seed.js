/**
 * Load the catalogue and a set of demo accounts.
 * Run with: npm run seed  (or db-reset, which loads the schema first)
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, q, one, run } from '../src/db.js';
import { shareSlug } from '../src/lib/helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = async (name) => JSON.parse(await readFile(join(here, name), 'utf8'));

/** Fills out cities that have no hand-written activity list. */
function templateActivities(city) {
  const base = Number(city.cost_index);
  const round = (n) => Math.max(0, Math.round(n));
  return [
    [`${city.name} old town walking tour`, 'sightseeing', round(base * 0.2), 150, `A guided loop of the landmarks and the streets between them.`],
    [`${city.name} food market tasting`, 'food', round(base * 0.28), 120, `Where people actually shop, with counters to eat at.`],
    [`${city.name} history museum`, 'culture', round(base * 0.15), 120, `The one collection worth an afternoon.`],
    [`Day hike near ${city.name}`, 'nature', round(base * 0.3), 300, `Out of the city by transport, back before dark.`],
    [`${city.name} sunset viewpoint`, 'sightseeing', 0, 90, `Free, busy, and worth the climb.`],
    [`${city.name} night out`, 'nightlife', round(base * 0.45), 180, `Bars the residents use, not the ones on the square.`],
    [`${city.name} craft market`, 'shopping', round(base * 0.35), 120, `Work made locally rather than imported for tourists.`],
  ];
}

async function seedCatalogue() {
  const cities = await readJson('cities.json');
  const curated = await readJson('activities.json');

  for (const c of cities) {
    const result = await run(
      `INSERT INTO cities (name, country, region, cost_index, popularity, currency, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.name, c.country, c.region, c.cost_index, c.popularity, c.currency, c.description]
    );
    const cityId = result.insertId;
    const list = curated[c.name] ?? templateActivities(c);

    for (const [name, category, cost, duration, description] of list) {
      await run(
        `INSERT INTO activities (city_id, name, category, cost, duration_minutes, description, popularity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cityId, name, category, cost, duration, description, Math.round(c.popularity * (0.6 + Math.random() * 0.4))]
      );
    }
  }
  const counts = await one('SELECT (SELECT COUNT(*) FROM cities) AS cities, (SELECT COUNT(*) FROM activities) AS activities');
  console.log(`  catalogue: ${counts.cities} cities, ${counts.activities} activities`);
}

/** Days from today, as 'YYYY-MM-DD'. */
function day(offset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function makeUser({ firstName, lastName, email, password, city, country, bio, role = 'user' }) {
  const result = await run(
    `INSERT INTO users (first_name, last_name, email, password_hash, city, country, bio, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [firstName, lastName, email, await bcrypt.hash(password, 10), city, country, bio, role]
  );
  return result.insertId;
}

const cityId = async (name) => (await one('SELECT id FROM cities WHERE name = ?', [name])).id;

/** Build a trip with stops, scheduled activities and a few entered costs. */
async function makeTrip(userId, spec) {
  const result = await run(
    `INSERT INTO trips (user_id, name, description, start_date, end_date, travellers, is_public, share_slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, spec.name, spec.description, spec.start, spec.end, spec.travellers ?? 1, spec.isPublic ? 1 : 0, spec.isPublic ? shareSlug() : null]
  );
  const tripId = result.insertId;

  for (const [index, stop] of spec.stops.entries()) {
    const id = await cityId(stop.city);
    const inserted = await run(
      'INSERT INTO trip_stops (trip_id, city_id, start_date, end_date, position, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [tripId, id, stop.start, stop.end, index, stop.notes ?? null]
    );
    const stopId = inserted.insertId;

    // Take the top activities of that city and spread them over the stop's days.
    const pool = await q(
      'SELECT * FROM activities WHERE city_id = ? ORDER BY popularity DESC LIMIT ?',
      [id, stop.activityCount ?? 3]
    );
    const nights = Math.max(
      1,
      Math.round((new Date(stop.end) - new Date(stop.start)) / 86400000) + 1
    );
    for (const [i, a] of pool.entries()) {
      const dayOffset = i % nights;
      const date = new Date(`${stop.start}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      await run(
        `INSERT INTO trip_activities
           (trip_id, stop_id, activity_id, title, category, cost, scheduled_date, start_time, duration_minutes, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tripId,
          stopId,
          a.id,
          a.name,
          a.category,
          a.cost,
          date.toISOString().slice(0, 10),
          ['09:00:00', '13:00:00', '18:00:00'][i % 3],
          a.duration_minutes,
          i,
        ]
      );
    }

    if (stop.stay) {
      await run('INSERT INTO trip_costs (trip_id, stop_id, category, label, amount) VALUES (?, ?, ?, ?, ?)', [
        tripId, stopId, 'stay', `${stop.city} accommodation`, stop.stay,
      ]);
    }
  }

  for (const leg of spec.transport ?? []) {
    await run('INSERT INTO trip_costs (trip_id, category, label, amount) VALUES (?, ?, ?, ?)', [
      tripId, 'transport', leg[0], leg[1],
    ]);
  }
  return tripId;
}

async function seedDemoData() {
  const admin = await makeUser({
    firstName: 'Priya', lastName: 'Nair', email: 'admin@globetrotter.app', password: 'globetrotter',
    city: 'Bengaluru', country: 'India', bio: 'Keeps the lights on and reads the analytics.', role: 'admin',
  });

  const demo = await makeUser({
    firstName: 'Sam', lastName: 'Rivera', email: 'sam@globetrotter.app', password: 'globetrotter',
    city: 'Lisbon', country: 'Portugal', bio: 'Two long trips a year, always by train where possible.',
  });

  const other = await makeUser({
    firstName: 'Mei', lastName: 'Tanaka', email: 'mei@globetrotter.app', password: 'globetrotter',
    city: 'Osaka', country: 'Japan', bio: 'Shares every itinerary. Copy them freely.',
  });

  await makeTrip(demo, {
    name: 'Iberian coast by rail',
    description: 'Three cities, no flights between them, and as much time by the water as the schedule allows.',
    start: day(-2), end: day(9), travellers: 2, isPublic: true,
    stops: [
      { city: 'Lisbon', start: day(-2), end: day(2), stay: 420, activityCount: 4 },
      { city: 'Porto', start: day(2), end: day(5), stay: 300, activityCount: 3 },
      { city: 'Barcelona', start: day(5), end: day(9), stay: 560, activityCount: 4 },
    ],
    transport: [['Flights to Lisbon', 640], ['Lisbon to Porto train', 60], ['Porto to Barcelona flight', 180]],
  });

  await makeTrip(demo, {
    name: 'Japan in autumn',
    description: 'Leaf season across Kansai, with a week in Tokyo at the end.',
    start: day(48), end: day(64), travellers: 2, isPublic: false,
    stops: [
      { city: 'Tokyo', start: day(48), end: day(53), stay: 780, activityCount: 5 },
      { city: 'Kyoto', start: day(53), end: day(59), stay: 690, activityCount: 4 },
      { city: 'Osaka', start: day(59), end: day(64), stay: 520, activityCount: 3 },
    ],
    transport: [['Return flights', 1450], ['Japan Rail Pass, 14 day', 680]],
  });

  await makeTrip(demo, {
    name: 'Morocco, first time',
    description: 'A short run at the medina and one night in the Atlas.',
    start: day(-186), end: day(-179), travellers: 1, isPublic: false,
    stops: [{ city: 'Marrakesh', start: day(-186), end: day(-179), stay: 340, activityCount: 5 }],
    transport: [['Return flights', 310]],
  });

  await makeTrip(other, {
    name: 'Andes and Amazon',
    description: 'Altitude first, jungle second. Two weeks with a rest day built in after the trek.',
    start: day(21), end: day(35), travellers: 1, isPublic: true,
    stops: [
      { city: 'Cusco', start: day(21), end: day(29), stay: 380, activityCount: 4 },
      { city: 'Rio de Janeiro', start: day(29), end: day(35), stay: 460, activityCount: 4 },
    ],
    transport: [['Flights to Cusco', 890], ['Cusco to Rio', 340]],
  });

  await makeTrip(other, {
    name: 'Nordic winter loop',
    description: 'Short days, long nights, and a lot of hot water.',
    start: day(75), end: day(84), travellers: 2, isPublic: true,
    stops: [
      { city: 'Copenhagen', start: day(75), end: day(79), stay: 640, activityCount: 3 },
      { city: 'Reykjavík', start: day(79), end: day(84), stay: 720, activityCount: 4 },
    ],
    transport: [['Return flights', 780], ['Rental car, five days', 420]],
  });

  const [lisbonTrip] = await q('SELECT id, share_slug FROM trips WHERE name = ?', ['Iberian coast by rail']);
  const posts = [
    [demo, lisbonTrip.id, await cityId('Lisbon'), 'Tram 28 is worth it if you board at the start',
      'Everyone tells you to skip it because of the crowds. Board at Martim Moniz instead of Praça Luís de Camões and you get a seat for the whole route. Go at half past eight on a weekday.'],
    [other, null, await cityId('Reykjavík'), 'Book the lagoon before you land',
      'Both lagoons sell out days ahead in winter and walk-ups get turned away at the door. We booked the 20:00 slot at Sky Lagoon and had the ritual almost to ourselves.'],
    [other, null, await cityId('Cusco'), 'Give yourself two days at altitude before any trek',
      'Cusco sits at 3,400 metres. We arrived and walked straight up to Sacsayhuamán, which was a mistake. Coca tea, a slow first day, and the trek was fine after that.'],
    [demo, null, await cityId('Tokyo'), 'The cheapest good meal in Tokyo is a department store basement',
      'Every big store has a food hall underneath. After seven in the evening the prepared food goes to half price and it is still better than most restaurants at home.'],
    [demo, null, await cityId('Barcelona'), 'Sagrada Família towers need a separate ticket',
      'The basilica ticket does not include the towers, and the tower slots go first. Book both at once, pick the Nativity side, and take the lift up rather than down.'],
  ];
  for (const [userId, tripId, city, title, body] of posts) {
    await run('INSERT INTO community_posts (user_id, trip_id, city_id, title, body) VALUES (?, ?, ?, ?, ?)', [
      userId, tripId, city, title, body,
    ]);
  }
  await run('INSERT IGNORE INTO post_likes (post_id, user_id) SELECT id, ? FROM community_posts', [admin]);

  for (const name of ['Kyoto', 'Reykjavík', 'Mexico City', 'Cape Town']) {
    await run('INSERT IGNORE INTO saved_cities (user_id, city_id) VALUES (?, ?)', [demo, await cityId(name)]);
  }

  console.log('  demo accounts (password: globetrotter)');
  console.log('    sam@globetrotter.app    traveller with three trips');
  console.log('    mei@globetrotter.app    shares public itineraries');
  console.log('    admin@globetrotter.app  admin dashboard');
}

async function main() {
  const existing = await one('SELECT COUNT(*) AS n FROM cities');
  if (existing.n > 0) {
    console.log('Seeding skipped: the catalogue already has rows. Run db-reset to start over.');
    return;
  }
  console.log('Seeding GlobeTrotter ...');
  await seedCatalogue();
  await seedDemoData();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
