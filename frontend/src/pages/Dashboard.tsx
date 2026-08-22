import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { currency, dateRange, longDate, relativeDays } from '../lib/format';
import type { City, Trip, User } from '../lib/types';
import { Plate } from '../components/Plate';
import { RouteStrip, StatusPill, TripCard } from '../components/TripCard';
import { ControlStrip } from '../components/ControlStrip';
import { Button, Empty, Notice, Spinner } from '../components/ui';

interface DashboardData {
  user: User;
  ongoing: Trip[];
  upcoming: Trip[];
  previous: Trip[];
  nextTrip: Trip | null;
  recommended: City[];
  regions: { region: string; city_count: number; avg_daily_cost: number }[];
  highlights: { tripCount: number; plannedSpend: number; countriesPlanned: number; daysAway: number };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [sort, setSort] = useState('popularity');

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).catch((err) => setError(errorText(err)));
  }, []);

  const shown = useMemo(() => {
    if (!data) return [];
    let list = data.recommended;
    if (region !== 'all') list = list.filter((c) => c.region === region);
    if (query) {
      const needle = query.toLowerCase();
      list = list.filter((c) => `${c.name} ${c.country} ${c.region}`.toLowerCase().includes(needle));
    }
    const by: Record<string, (a: City, b: City) => number> = {
      popularity: (a, b) => b.popularity - a.popularity,
      'cost-low': (a, b) => Number(a.cost_index) - Number(b.cost_index),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort] ?? by.popularity);
  }, [data, query, region, sort]);

  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Spinner label="Loading your trips" />;

  const { highlights, nextTrip } = data;

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------- banner */}
      <section className="rise relative overflow-hidden rounded-[16px] bg-ink text-white">
        <Plate name={nextTrip?.stops?.[0]?.city_name ?? nextTrip?.name ?? 'GlobeTrotter atlas'} ratio="" className="absolute inset-0 h-full w-full opacity-30 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/92 to-ink/45" />

        <div className="relative grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <p className="eyebrow mb-2 text-[#8397AA]">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-[32px] leading-[1.06] text-white md:text-[38px]">
              {greeting()}, {data.user.first_name}.
            </h1>
            <p className="mt-2 max-w-[46ch] text-[15px] text-[#A9BACB]">
              {!nextTrip
                ? 'Nothing is booked in. Pick a first city and the rest of the plan follows from it.'
                : nextTrip.status === 'ongoing'
                  ? `You are on ${nextTrip.name} right now — it runs until ${longDate(nextTrip.end_date)}.`
                  : `${nextTrip.name} starts ${relativeDays(nextTrip.start_date)}${cityPhrase(nextTrip.route?.length ?? 0)}.`}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => navigate('/trips/new')}>
                <Plus size={15} /> Plan a new trip
              </Button>
              {nextTrip && (
                <Link to={`/trips/${nextTrip.id}`}>
                  <Button variant="quiet" className="border-white/20 bg-white/10 text-white hover:bg-white/18">
                    Open {nextTrip.name} <ArrowRight size={15} />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px self-end overflow-hidden rounded-[12px] border border-white/12 bg-white/12">
            <Stat label="Trips planned" value={String(highlights.tripCount)} />
            <Stat label="Days away" value={String(highlights.daysAway)} />
            <Stat label="Countries" value={String(highlights.countriesPlanned)} />
            <Stat label="Planned spend" value={currency(highlights.plannedSpend)} />
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------ happening now */}
      {data.ongoing.length > 0 && (
        <section>
          <SectionHead title="Happening now" hint={`${data.ongoing.length} trip in progress`} />
          <div className="space-y-3">
            {data.ongoing.map((trip) => <TripCard key={trip.id} trip={trip} />)}
          </div>
        </section>
      )}

      {/* ------------------------------------------------- regional selection */}
      <section>
        <SectionHead
          title="Top regional selections"
          hint="Places that suit what you have not seen yet"
          action={<Link to="/explore" className="text-[13px] font-medium text-route hover:underline">Search all cities</Link>}
        />

        <ControlStrip
          query={query}
          onQuery={setQuery}
          placeholder="Search the recommendations…"
          groupBy={region}
          onGroupBy={setRegion}
          groupOptions={[
            { value: 'all', label: 'All regions' },
            ...data.regions.map((r) => ({ value: r.region, label: r.region })),
          ]}
          sortBy={sort}
          onSortBy={setSort}
          sortOptions={[
            { value: 'popularity', label: 'Popularity' },
            { value: 'cost-low', label: 'Daily cost' },
            { value: 'name', label: 'Name' },
          ]}
        />

        {shown.length === 0 ? (
          <Empty title="Nothing matches that" body="Clear the search or pick a different region to see suggestions again." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((city) => (
              <Link
                key={city.id}
                to={`/explore?q=${encodeURIComponent(city.name)}`}
                className="card group overflow-hidden p-2 transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(11,27,43,0.4)]"
              >
                <Plate name={city.name} ratio="aspect-[16/10]" label={city.region} />
                <div className="px-1 pb-1 pt-2.5">
                  <h3 className="truncate text-[15.5px] group-hover:text-route">{city.name}</h3>
                  <p className="truncate text-[12.5px] text-slate">{city.country}</p>
                  <p className="num mt-2 text-[12px] text-mist">
                    {currency(city.cost_index)}<span className="text-mist"> / day</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- next up */}
      <section>
        <SectionHead
          title="Coming up"
          hint="Trips with a start date ahead of today"
          action={<Link to="/trips" className="text-[13px] font-medium text-route hover:underline">All trips</Link>}
        />
        {data.upcoming.length === 0 ? (
          <Empty
            title="Nothing on the calendar"
            body="Create a trip, add the cities you want to reach, and the days fill themselves in."
            action={<Button variant="primary" onClick={() => navigate('/trips/new')}><Plus size={15} /> Plan a new trip</Button>}
          />
        ) : (
          <div className="space-y-3">
            {data.upcoming.map((trip) => <TripCard key={trip.id} trip={trip} />)}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ previous trips */}
      {data.previous.length > 0 && (
        <section>
          <SectionHead title="Previous trips" hint="Copy one to plan the same route again" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.previous.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`} className="card group p-3 transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(11,27,43,0.4)]">
                <Plate name={trip.route?.[0]?.city ?? trip.name} ratio="aspect-[16/9]" label={trip.route?.[0]?.city} />
                <div className="pt-3">
                  <StatusPill status={trip.status} />
                  <h3 className="mt-1.5 truncate text-[16px] group-hover:text-route">{trip.name}</h3>
                  <p className="num mt-0.5 text-[12px] text-mist">{dateRange(trip.start_date, trip.end_date)}</p>
                  <div className="mt-2.5 border-t pt-2.5"><RouteStrip route={trip.route ?? []} /></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** ', across 3 cities' — and nothing at all when no stop is planned yet. */
function cityPhrase(count: number) {
  if (count === 0) return ', with no stops planned yet';
  return count === 1 ? ', with one city on the plan' : `, across ${count} cities`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink px-4 py-3">
      <dt className="eyebrow text-[#7A8DA0]">{label}</dt>
      <dd className="num mt-0.5 text-[19px] font-semibold text-white">{value}</dd>
    </div>
  );
}

export function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[21px]">{title}</h2>
        {hint && <p className="text-[13px] text-slate">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
