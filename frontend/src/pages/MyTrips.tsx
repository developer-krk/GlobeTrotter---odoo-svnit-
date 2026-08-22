import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, errorText } from '../lib/api';
import type { Trip, TripStatus } from '../lib/types';
import { TripCard } from '../components/TripCard';
import { ControlStrip } from '../components/ControlStrip';
import { Button, Empty, Notice, Spinner } from '../components/ui';

const GROUP_LABEL: Record<string, string> = {
  ongoing: 'Ongoing',
  upcoming: 'Up-coming',
  completed: 'Completed',
};

export default function MyTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('status');
  const [sort, setSort] = useState('soonest');
  const [statuses, setStatuses] = useState<TripStatus[]>([]);

  useEffect(() => {
    api.get('/trips').then(({ data }) => setTrips(data.trips)).catch((err) => setError(errorText(err)));
  }, []);

  const groups = useMemo(() => {
    if (!trips) return [];

    let list = trips;
    if (query) {
      const needle = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          (t.description ?? '').toLowerCase().includes(needle) ||
          (t.route ?? []).some((r) => r.city.toLowerCase().includes(needle))
      );
    }
    if (statuses.length) list = list.filter((t) => statuses.includes(t.status));

    const order: Record<string, (a: Trip, b: Trip) => number> = {
      soonest: (a, b) => a.start_date.localeCompare(b.start_date),
      latest: (a, b) => b.start_date.localeCompare(a.start_date),
      name: (a, b) => a.name.localeCompare(b.name),
      'cost-high': (a, b) => b.budget.total - a.budget.total,
      longest: (a, b) => b.days - a.days,
    };
    list = [...list].sort(order[sort] ?? order.soonest);

    if (group === 'none') return [{ key: 'all', label: `${list.length} trips`, trips: list }];

    const key = (trip: Trip) =>
      group === 'status' ? trip.status
      : group === 'country' ? (trip.route?.[0]?.country ?? 'No stops yet')
      : trip.start_date.slice(0, 4);

    const buckets = new Map<string, Trip[]>();
    for (const trip of list) {
      const k = key(trip);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(trip);
    }

    const sortedKeys =
      group === 'status'
        ? (['ongoing', 'upcoming', 'completed'] as const).filter((s) => buckets.has(s))
        : [...buckets.keys()].sort();

    return sortedKeys.map((k) => ({
      key: k,
      label: GROUP_LABEL[k] ?? k,
      trips: buckets.get(k)!,
    }));
  }, [trips, query, group, sort, statuses]);

  const toggleStatus = (status: TripStatus) =>
    setStatuses((current) =>
      current.includes(status) ? current.filter((s) => s !== status) : [...current, status]
    );

  if (error) return <Notice>{error}</Notice>;
  if (!trips) return <Spinner label="Loading your trips" />;

  const total = groups.reduce((sum, g) => sum + g.trips.length, 0);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">{trips.length} trips</p>
          <h1 className="text-[30px]">My trips</h1>
        </div>
        <Button variant="primary" onClick={() => navigate('/trips/new')}>
          <Plus size={15} /> Plan a new trip
        </Button>
      </header>

      <ControlStrip
        query={query}
        onQuery={setQuery}
        placeholder="Search by trip name, description or city…"
        groupBy={group}
        onGroupBy={setGroup}
        groupOptions={[
          { value: 'status', label: 'Status' },
          { value: 'country', label: 'First country' },
          { value: 'year', label: 'Year' },
          { value: 'none', label: 'Nothing' },
        ]}
        sortBy={sort}
        onSortBy={setSort}
        sortOptions={[
          { value: 'soonest', label: 'Soonest first' },
          { value: 'latest', label: 'Latest first' },
          { value: 'name', label: 'Name' },
          { value: 'cost-high', label: 'Most expensive' },
          { value: 'longest', label: 'Longest' },
        ]}
        filterCount={statuses.length}
        filterPanel={
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Show only</span>
            {(['ongoing', 'upcoming', 'completed'] as TripStatus[]).map((status) => {
              const on = statuses.includes(status);
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                    on ? 'border-route bg-route text-white' : 'border-rule bg-surface text-slate hover:bg-canvas'
                  }`}
                >
                  {GROUP_LABEL[status]}
                </button>
              );
            })}
            {statuses.length > 0 && (
              <button onClick={() => setStatuses([])} className="ml-1 text-[12.5px] text-slate underline-offset-2 hover:underline">
                Clear
              </button>
            )}
          </div>
        }
      />

      {total === 0 ? (
        <Empty
          title={trips.length === 0 ? 'No trips yet' : 'Nothing matches those filters'}
          body={
            trips.length === 0
              ? 'A trip starts with a name and two dates. Everything else can change later.'
              : 'Clear the search or the status filter to see your trips again.'
          }
          action={
            trips.length === 0 ? (
              <Button variant="primary" onClick={() => navigate('/trips/new')}><Plus size={15} /> Plan a new trip</Button>
            ) : (
              <Button onClick={() => { setQuery(''); setStatuses([]); }}>Clear filters</Button>
            )
          }
        />
      ) : (
        <div className="space-y-7">
          {groups.map((bucket) => (
            <section key={bucket.key}>
              <div className="mb-2.5 flex items-baseline gap-3">
                <h2 className="text-[19px]">{bucket.label}</h2>
                <span className="num text-[12.5px] text-mist">{bucket.trips.length}</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
              <div className="space-y-3">
                {bucket.trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
