import type { Category } from './types';

/**
 * 'YYYY-MM-DD' for a Date in the viewer's own timezone.
 *
 * toISOString() converts to UTC first, which lands on the previous day for
 * anyone ahead of UTC — the whole itinerary would shift by one.
 */
export const isoLocal = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Every date from start to end, inclusive, in local time. */
export function eachDate(start: string, end: string) {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    out.push(isoLocal(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Which stop a date belongs to.
 *
 * Consecutive stops share the travel day: you leave one city and arrive in the
 * next on the same date. The arriving stop wins, because that is where the day
 * is spent and where its activities are planned.
 */
export function stopForDate<T extends { start_date: string; end_date: string }>(stops: T[], date: string): T | null {
  return (
    stops.find((s) => s.start_date === date) ??
    stops.find((s) => date >= s.start_date && date <= s.end_date) ??
    null
  );
}

const money0 = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});

export const currency = (value: number | string | null | undefined) =>
  money0.format(Number(value ?? 0));

/** '12 Mar' */
export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** '12 Mar 2026' */
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** 'Thursday 12 March' */
export const dayName = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** '12 Mar – 24 Mar 2026' */
export function dateRange(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  });
  const right = b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${left} – ${right}`;
}

/** '2h 30m' */
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** '14:00' from '14:00:00' */
export const clock = (time: string | null) => (time ? time.slice(0, 5) : null);

/** 'in 12 days' / '4 days ago' / 'today' */
export function relativeDays(iso: string, from = new Date()) {
  const target = new Date(`${iso}T00:00:00`);
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - base.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export const CATEGORIES: Category[] = [
  'sightseeing', 'food', 'culture', 'nature', 'adventure', 'nightlife', 'shopping', 'relaxation',
];

/** Every category gets one colour, used the same way everywhere. */
export const categoryTone: Record<Category, { fg: string; bg: string }> = {
  sightseeing: { fg: '#2647E8', bg: '#E5E9FD' },
  food:        { fg: '#C0431F', bg: '#FBE4DF' },
  culture:     { fg: '#7B3FBF', bg: '#F0E7FB' },
  nature:      { fg: '#0E8F87', bg: '#D8F0EE' },
  adventure:   { fg: '#B26A00', bg: '#FBEFD4' },
  nightlife:   { fg: '#1F3A5F', bg: '#DEE6EF' },
  shopping:    { fg: '#A8306B', bg: '#F9E1EE' },
  relaxation:  { fg: '#3F7A2E', bg: '#E4F1DD' },
};

/**
 * Colours for the budget breakdown, held apart from the category scale.
 * Fixed order, never cycled, and checked for colour-vision separation.
 */
export const costTone: Record<string, string> = {
  transport: '#2647E8',
  stay: '#00A79C',
  activities: '#D99400',
  meals: '#C93C24',
  other: '#8B45D0',
};

export const costLabel: Record<string, string> = {
  transport: 'Getting around',
  stay: 'Places to stay',
  activities: 'Things to do',
  meals: 'Food and daily spend',
  other: 'Everything else',
};

/** A stable number from a string, so generated artwork never flickers. */
export function seedFrom(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
