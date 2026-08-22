import { q, one } from '../db.js';
import { dayCount, eachDate, isoDate, tripStatus, notFound } from './helpers.js';

/** Load a trip with its stops, activities and extra costs, shaped for the UI. */
export async function loadTrip(tripId) {
  const trip = await one(
    `SELECT t.*, u.first_name, u.last_name, u.photo_url AS owner_photo
       FROM trips t JOIN users u ON u.id = t.user_id
      WHERE t.id = ?`,
    [tripId]
  );
  if (!trip) throw notFound('That trip does not exist.');

  const [stops, activities, costs] = await Promise.all([
    q(
      `SELECT s.*, c.name AS city_name, c.country, c.region, c.cost_index, c.image_url AS city_image
         FROM trip_stops s JOIN cities c ON c.id = s.city_id
        WHERE s.trip_id = ? ORDER BY s.position ASC, s.start_date ASC`,
      [tripId]
    ),
    q(
      `SELECT * FROM trip_activities WHERE trip_id = ?
        ORDER BY scheduled_date ASC, position ASC, id ASC`,
      [tripId]
    ),
    q('SELECT * FROM trip_costs WHERE trip_id = ? ORDER BY id ASC', [tripId]),
  ]);

  const byStop = new Map(stops.map((s) => [s.id, []]));
  for (const a of activities) byStop.get(a.stop_id)?.push(a);

  return {
    ...trip,
    start_date: isoDate(trip.start_date),
    end_date: isoDate(trip.end_date),
    owner_name: `${trip.first_name} ${trip.last_name}`.trim(),
    status: tripStatus(trip.start_date, trip.end_date),
    days: dayCount(trip.start_date, trip.end_date),
    stops: stops.map((s) => ({
      ...s,
      start_date: isoDate(s.start_date),
      end_date: isoDate(s.end_date),
      nights: Math.max(0, dayCount(s.start_date, s.end_date) - 1),
      activities: (byStop.get(s.id) ?? []).map((a) => ({ ...a, scheduled_date: isoDate(a.scheduled_date) })),
    })),
    costs,
    budget: budgetFor(trip, stops, activities, costs),
  };
}

/**
 * Estimate the trip budget.
 *
 * Activities are summed from what the traveller actually scheduled. Meals are
 * estimated from each city's daily cost index unless the traveller entered a
 * meals cost of their own. Transport and stay come only from entered costs.
 */
export function budgetFor(trip, stops, activities, costs) {
  const travellers = Math.max(1, trip.travellers || 1);

  const entered = { transport: 0, stay: 0, meals: 0, other: 0 };
  for (const c of costs) entered[c.category] += Number(c.amount);

  const activitiesTotal = activities.reduce((sum, a) => sum + Number(a.cost), 0) * travellers;

  /*
   * Give every date of the trip to exactly one stop.
   *
   * Consecutive stops share the travel day — you leave one city and arrive in
   * the next on the same date — so a plain overlap check would charge that day
   * twice. The arriving stop takes it, which is also where the itinerary shows
   * it and where its activities are planned.
   */
  const dateOwner = new Map();
  for (const date of eachDate(trip.start_date, trip.end_date)) {
    const owner =
      stops.find((s) => isoDate(s.start_date) === date) ??
      stops.find((s) => date >= isoDate(s.start_date) && date <= isoDate(s.end_date));
    if (owner) dateOwner.set(date, owner);
  }

  // Fall back to the city cost index for meals when nothing was entered.
  const estimatedMeals = [...dateOwner.values()].reduce(
    (sum, s) => sum + Number(s.cost_index || 0) * travellers,
    0
  );
  const meals = entered.meals > 0 ? entered.meals : Math.round(estimatedMeals);

  const breakdown = [
    { category: 'transport', amount: Math.round(entered.transport), estimated: false },
    { category: 'stay', amount: Math.round(entered.stay), estimated: false },
    { category: 'activities', amount: Math.round(activitiesTotal), estimated: false },
    { category: 'meals', amount: meals, estimated: entered.meals === 0 && estimatedMeals > 0 },
    { category: 'other', amount: Math.round(entered.other), estimated: false },
  ];

  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
  const days = dayCount(trip.start_date, trip.end_date);

  // Per-day spend, so a day that runs away with the budget is visible.
  const perDay = new Map(eachDate(trip.start_date, trip.end_date).map((d) => [d, 0]));
  for (const a of activities) {
    const d = isoDate(a.scheduled_date);
    if (perDay.has(d)) perDay.set(d, perDay.get(d) + Number(a.cost) * travellers);
  }
  for (const [date, stop] of dateOwner) {
    if (perDay.has(date)) perDay.set(date, perDay.get(date) + Number(stop.cost_index || 0) * travellers);
  }

  const daily = [...perDay.entries()].map(([date, amount]) => ({ date, amount: Math.round(amount) }));

  /*
   * Two averages, because they answer different questions.
   *
   * averagePerDay spreads the whole budget — flights and hotels included —
   * across the trip, which is the number to quote when someone asks what a day
   * costs. dailyAverage is the mean of what the day-by-day series actually
   * holds, and only that one can be compared against a single day's bar.
   */
  const averagePerDay = Math.round(total / days);
  const dailyAverage = daily.length
    ? Math.round(daily.reduce((sum, d) => sum + d.amount, 0) / daily.length)
    : 0;

  // A day is flagged when it costs half again as much as a typical day.
  const threshold = Math.round(dailyAverage * 1.5);

  // How many days and how much estimated food each stop actually owns.
  const byStop = stops.map((s) => {
    const owned = [...dateOwner.entries()].filter(([, owner]) => owner.id === s.id).length;
    return {
      stopId: s.id,
      days: owned,
      meals: Math.round(Number(s.cost_index || 0) * owned * travellers),
    };
  });

  return {
    total,
    days,
    travellers,
    averagePerDay,
    dailyAverage,
    byStop,
    perTraveller: Math.round(total / travellers),
    breakdown: breakdown.filter((b) => b.amount > 0),
    daily,
    threshold,
    heavyDays: daily.filter((d) => d.amount > threshold && threshold > 0),
  };
}

/** Trip rows for a list screen, each with a compact route preview. */
export async function listTrips(userId) {
  const trips = await q(
    `SELECT t.*,
            COUNT(DISTINCT s.id) AS stop_count,
            COUNT(DISTINCT a.id) AS activity_count
       FROM trips t
       LEFT JOIN trip_stops s ON s.trip_id = t.id
       LEFT JOIN trip_activities a ON a.trip_id = t.id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.start_date DESC`,
    [userId]
  );
  if (trips.length === 0) return [];

  const ids = trips.map((t) => t.id);
  const [routes, costs, activities] = await Promise.all([
    q(
      `SELECT s.trip_id, s.id, s.start_date, s.end_date, s.city_id, c.name AS city_name, c.country, c.cost_index
         FROM trip_stops s JOIN cities c ON c.id = s.city_id
        WHERE s.trip_id IN (?) ORDER BY s.position ASC`,
      [ids]
    ),
    q('SELECT * FROM trip_costs WHERE trip_id IN (?)', [ids]),
    q('SELECT * FROM trip_activities WHERE trip_id IN (?)', [ids]),
  ]);

  const group = (rows) =>
    rows.reduce((map, r) => {
      (map[r.trip_id] ??= []).push(r);
      return map;
    }, {});
  const stopsBy = group(routes);
  const costsBy = group(costs);
  const actsBy = group(activities);

  return trips.map((t) => ({
    ...t,
    start_date: isoDate(t.start_date),
    end_date: isoDate(t.end_date),
    status: tripStatus(t.start_date, t.end_date),
    days: dayCount(t.start_date, t.end_date),
    route: (stopsBy[t.id] ?? []).map((s) => ({ id: s.id, city: s.city_name, country: s.country })),
    budget: budgetFor(t, stopsBy[t.id] ?? [], actsBy[t.id] ?? [], costsBy[t.id] ?? []),
  }));
}

/** Throw unless the trip exists and belongs to the user. */
export async function ownedTrip(tripId, userId) {
  const trip = await one('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) throw notFound('That trip does not exist.');
  if (trip.user_id !== userId) throw notFound('That trip does not exist.');
  return trip;
}
