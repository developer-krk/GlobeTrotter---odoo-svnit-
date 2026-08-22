import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { categoryTone, costTone, longDate } from '../lib/format';
import { ControlStrip } from '../components/ControlStrip';
import { Avatar } from '../components/Plate';
import { Button, Empty, Modal, Notice, Spinner } from '../components/ui';

type Tab = 'users' | 'cities' | 'activities' | 'trends';

interface Stats {
  totals: { users: number; trips: number; stops: number; activities: number; shared_trips: number; posts: number };
  tripsByMonth: { month: string; trips: number }[];
  topCities: { id: number; name: string; country: string; visits: number }[];
  topActivities: { title: string; times_added: number; avg_cost: number }[];
  categoryMix: { category: keyof typeof categoryTone; n: number }[];
  avgTripDays: number;
}

interface AdminUser {
  id: number; first_name: string; last_name: string; email: string;
  city: string | null; country: string | null; role: 'user' | 'admin';
  created_at: string; trip_count: number; last_trip_at: string | null;
}

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: 'users', label: 'Manage users', blurb: 'Every account, how much they plan, and what they have booked in.' },
  { key: 'cities', label: 'Popular cities', blurb: 'Where people are actually going, counted from real stops.' },
  { key: 'activities', label: 'Popular activities', blurb: 'What gets added to itineraries most often.' },
  { key: 'trends', label: 'User trends', blurb: 'How the platform is being used over time.' },
];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('trips');
  const [error, setError] = useState('');
  const [inspect, setInspect] = useState<AdminUser | null>(null);

  const load = () => {
    api.get('/admin/stats').then(({ data }) => setStats(data)).catch((err) => setError(errorText(err)));
    api.get('/admin/users').then(({ data }) => setUsers(data.users)).catch((err) => setError(errorText(err)));
  };
  useEffect(load, []);

  const shownUsers = useMemo(() => {
    let list = users;
    if (query) {
      const needle = query.toLowerCase();
      list = list.filter((u) => `${u.first_name} ${u.last_name} ${u.email} ${u.city ?? ''}`.toLowerCase().includes(needle));
    }
    const order: Record<string, (a: AdminUser, b: AdminUser) => number> = {
      trips: (a, b) => b.trip_count - a.trip_count,
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      name: (a, b) => a.first_name.localeCompare(b.first_name),
    };
    return [...list].sort(order[sort] ?? order.trips);
  }, [users, query, sort]);

  async function setRole(target: AdminUser, role: 'user' | 'admin') {
    try {
      await api.patch(`/admin/users/${target.id}`, { role });
      setUsers((current) => current.map((u) => (u.id === target.id ? { ...u, role } : u)));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function removeUser(target: AdminUser) {
    try {
      await api.delete(`/admin/users/${target.id}`);
      setUsers((current) => current.filter((u) => u.id !== target.id));
      setInspect(null);
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (error && !stats) return <Notice>{error}</Notice>;
  if (!stats) return <Spinner label="Loading platform data" />;

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div>
      <header className="mb-5">
        <p className="eyebrow mb-1.5 inline-flex items-center gap-1.5">
          <ShieldCheck size={12} /> Signed in as {user?.first_name}
        </p>
        <h1 className="text-[30px]">Admin dashboard</h1>
        <p className="mt-1 max-w-[62ch] text-[14.5px] text-slate">
          Platform-wide numbers. Everything here counts real rows, not samples.
        </p>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Users" value={stats.totals.users} />
        <Tile label="Trips" value={stats.totals.trips} />
        <Tile label="Stops" value={stats.totals.stops} />
        <Tile label="Activities" value={stats.totals.activities} />
        <Tile label="Shared" value={stats.totals.shared_trips} />
        <Tile label="Avg trip" value={`${stats.avgTripDays}d`} />
      </section>

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[14px] font-medium transition-colors ${
              tab === entry.key ? 'border-route text-route' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-[13.5px] text-slate">{active.blurb}</p>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}

      {tab === 'users' && (
        <>
          <ControlStrip
            query={query}
            onQuery={setQuery}
            placeholder="Search by name, email or city…"
            sortBy={sort}
            onSortBy={setSort}
            sortOptions={[
              { value: 'trips', label: 'Most trips' },
              { value: 'newest', label: 'Newest' },
              { value: 'name', label: 'Name' },
            ]}
          />

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b bg-canvas/60">
                  <th className="eyebrow px-4 py-2.5 text-left">Person</th>
                  <th className="eyebrow px-3 py-2.5 text-left">Based in</th>
                  <th className="eyebrow px-3 py-2.5 text-right">Trips</th>
                  <th className="eyebrow px-3 py-2.5 text-left">Joined</th>
                  <th className="eyebrow px-3 py-2.5 text-left">Role</th>
                  <th className="eyebrow px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shownUsers.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={`${row.first_name} ${row.last_name}`} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{row.first_name} {row.last_name}</span>
                          <span className="num block truncate text-[11.5px] text-mist">{row.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate">{[row.city, row.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold">{row.trip_count}</td>
                    <td className="num px-3 py-2.5 text-slate">{longDate(row.created_at.slice(0, 10))}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={row.role}
                        onChange={(e) => setRole(row, e.target.value as 'user' | 'admin')}
                        className="rounded-[8px] border bg-surface px-2 py-1 text-[12.5px]"
                        aria-label={`Role for ${row.first_name}`}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setInspect(row)}>
                        <UserCog size={14} /> Trips
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shownUsers.length === 0 && <p className="px-4 py-8 text-center text-[13.5px] text-mist">No account matches that search.</p>}
          </div>
        </>
      )}

      {tab === 'cities' && (
        stats.topCities.length === 0 ? <Empty title="No stops recorded yet" body="Once travellers add cities to their trips, the ranking builds itself." /> : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="card p-5">
              <h2 className="mb-3 text-[18px]">Most visited cities</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topCities} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={96}
                      tick={{ fontSize: 12, fill: 'var(--color-slate)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: 'var(--color-sunk)' }} content={<PlainTooltip suffix="stops" />} />
                    <Bar dataKey="visits" radius={[0, 4, 4, 0]} fill={costTone.transport} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b px-4 py-3"><h2 className="text-[16px]">The numbers</h2></div>
              <table className="w-full text-[13.5px]">
                <tbody>
                  {stats.topCities.map((city, index) => (
                    <tr key={city.id} className="border-b last:border-b-0">
                      <td className="num w-8 px-3 py-2 text-mist">{index + 1}</td>
                      <td className="px-1 py-2 font-medium">{city.name}</td>
                      <td className="px-3 py-2 text-slate">{city.country}</td>
                      <td className="num px-4 py-2 text-right font-semibold">{city.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === 'activities' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="card overflow-hidden">
            <div className="border-b px-4 py-3"><h2 className="text-[16px]">Added to the most itineraries</h2></div>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-canvas/60">
                  <th className="eyebrow px-4 py-2 text-left">Activity</th>
                  <th className="eyebrow px-3 py-2 text-right">Times added</th>
                  <th className="eyebrow px-4 py-2 text-right">Average cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.topActivities.map((row) => (
                  <tr key={row.title} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{row.title}</td>
                    <td className="num px-3 py-2 text-right font-semibold">{row.times_added}</td>
                    <td className="num px-4 py-2 text-right text-slate">${row.avg_cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.topActivities.length === 0 && <p className="px-4 py-8 text-center text-[13.5px] text-mist">No activities scheduled yet.</p>}
          </div>

          <div className="card p-5">
            <h2 className="mb-1 text-[18px]">What kind of activity</h2>
            <p className="mb-3 text-[13px] text-slate">Every scheduled activity, counted by its category.</p>
            <ul className="space-y-2.5">
              {stats.categoryMix.map((row) => {
                const tone = categoryTone[row.category] ?? categoryTone.sightseeing;
                const max = Math.max(...stats.categoryMix.map((c) => c.n), 1);
                return (
                  <li key={row.category}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="capitalize text-slate">{row.category}</span>
                      <span className="num font-semibold">{row.n}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunk">
                      <div className="h-full rounded-full" style={{ width: `${(row.n / max) * 100}%`, background: tone.fg }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {tab === 'trends' && (
        <div className="grid gap-4">
          <div className="card p-5">
            <h2 className="mb-1 text-[18px]">Trips created each month</h2>
            <p className="mb-3 text-[13px] text-slate">Counted from when the trip was created, not when it starts.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.tripsByMonth} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-mist)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--color-rule)' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-mist)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<PlainTooltip suffix="trips" />} />
                  <Line
                    type="monotone"
                    dataKey="trips"
                    stroke={costTone.transport}
                    strokeWidth={2}
                    dot={{ r: 4, fill: costTone.transport, stroke: 'var(--color-surface)', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Insight label="Trips per user" value={(stats.totals.trips / Math.max(1, stats.totals.users)).toFixed(1)} note="Across every account" />
            <Insight label="Stops per trip" value={(stats.totals.stops / Math.max(1, stats.totals.trips)).toFixed(1)} note="Multi-city is the norm" />
            <Insight label="Shared publicly" value={`${Math.round((stats.totals.shared_trips / Math.max(1, stats.totals.trips)) * 100)}%`} note="Of all trips created" />
          </div>
        </div>
      )}

      <Modal open={Boolean(inspect)} onClose={() => setInspect(null)} title={inspect ? `${inspect.first_name} ${inspect.last_name}` : ''}>
        {inspect && <UserTrips user={inspect} onDelete={removeUser} />}
      </Modal>
    </div>
  );
}

function UserTrips({ user, onDelete }: { user: AdminUser; onDelete: (user: AdminUser) => void }) {
  const [trips, setTrips] = useState<any[] | null>(null);

  useEffect(() => {
    api.get(`/admin/users/${user.id}/trips`).then(({ data }) => setTrips(data.trips)).catch(() => setTrips([]));
  }, [user.id]);

  return (
    <div className="space-y-4">
      <p className="num text-[13px] text-slate">{user.email} · joined {longDate(user.created_at.slice(0, 10))}</p>

      {trips === null ? <Spinner label="Loading trips" /> : trips.length === 0 ? (
        <p className="rounded-[10px] border border-dashed px-3 py-6 text-center text-[13px] text-mist">
          This account has not created a trip yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {trips.map((trip) => (
            <li key={trip.id} className="flex items-center gap-3 rounded-[10px] border px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{trip.name}</span>
                <span className="num block text-[11.5px] text-mist">
                  {trip.start_date} → {trip.end_date} · {trip.stop_count} stops
                </span>
              </span>
              {trip.is_public === 1 && <span className="eyebrow rounded-full bg-sea-soft px-2 py-0.5 text-sea">shared</span>}
            </li>
          ))}
        </ul>
      )}

      {user.role !== 'admin' && (
        <div className="border-t pt-4">
          <Button variant="danger" onClick={() => onDelete(user)} className="w-full">
            <Trash2 size={14} /> Delete this account and its trips
          </Button>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3.5">
      <p className="eyebrow">{label}</p>
      <p className="num mt-0.5 text-[22px] font-semibold leading-tight">{value}</p>
    </div>
  );
}

function Insight({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="num mt-1 text-[26px] font-semibold leading-tight">{value}</p>
      <p className="text-[12px] text-mist">{note}</p>
    </div>
  );
}

function PlainTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 shadow-[0_10px_28px_-14px_rgba(11,27,43,0.5)]">
      <p className="text-[12.5px] font-medium">{payload[0].payload.name ?? label}</p>
      <p className="num text-[15px] font-semibold">{payload[0].value} <span className="text-[12px] font-normal text-mist">{suffix}</span></p>
    </div>
  );
}
