import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Clock, MapPin, Plus, Wallet } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { CATEGORIES, categoryTone, currency, duration } from '../lib/format';
import type { Activity, City, Trip } from '../lib/types';
import { Plate } from '../components/Plate';
import { ControlStrip } from '../components/ControlStrip';
import { Button, Empty, Fieldset, Modal, Notice, Select, Spinner } from '../components/ui';

type Tab = 'cities' | 'activities';

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'cities');

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [sort, setSort] = useState('popularity');
  const [group, setGroup] = useState('none');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [maxCost, setMaxCost] = useState('');
  const [category, setCategory] = useState('');
  const [maxDuration, setMaxDuration] = useState('');

  const [cities, setCities] = useState<City[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [facets, setFacets] = useState<{ countries: any[]; regions: any[] } | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<{ city?: City; activity?: Activity } | null>(null);

  useEffect(() => {
    api.get('/cities/facets').then(({ data }) => setFacets(data)).catch(() => setFacets(null));
    api.get('/cities/saved/mine')
      .then(({ data }) => setSaved(new Set(data.cities.map((c: City) => c.id))))
      .catch(() => setSaved(new Set()));
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (tab !== 'cities') next.set('tab', tab);
    setParams(next, { replace: true });
  }, [query, tab]);

  useEffect(() => {
    if (tab !== 'cities') return;
    setCities(null);
    api.get('/cities', {
      params: { q: query || undefined, country: country || undefined, region: region || undefined, maxCost: maxCost || undefined, sort, limit: 60 },
    })
      .then(({ data }) => setCities(data.cities))
      .catch((err) => { setError(errorText(err)); setCities([]); });
  }, [tab, query, country, region, maxCost, sort]);

  useEffect(() => {
    if (tab !== 'activities') return;
    setActivities(null);
    api.get('/activities', {
      params: { q: query || undefined, category: category || undefined, maxCost: maxCost || undefined, maxDuration: maxDuration || undefined, sort, limit: 80 },
    })
      .then(({ data }) => setActivities(data.activities))
      .catch((err) => { setError(errorText(err)); setActivities([]); });
  }, [tab, query, category, maxCost, maxDuration, sort]);

  async function toggleSave(city: City) {
    const isSaved = saved.has(city.id);
    setSaved((current) => {
      const next = new Set(current);
      if (isSaved) next.delete(city.id); else next.add(city.id);
      return next;
    });
    try {
      if (isSaved) await api.delete(`/cities/${city.id}/save`);
      else await api.post(`/cities/${city.id}/save`);
    } catch (err) {
      setError(errorText(err));
    }
  }

  const filterCount = [country, region, maxCost, category, maxDuration].filter(Boolean).length;

  const grouped = useMemo(() => {
    if (tab !== 'cities' || !cities) return null;
    if (group === 'none') return null;
    const key = (city: City) => (group === 'region' ? city.region : city.country);
    const buckets = new Map<string, City[]>();
    for (const city of cities) {
      const k = key(city);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(city);
    }
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tab, cities, group]);

  return (
    <div>
      <header className="mb-5">
        <p className="eyebrow mb-1.5">Catalogue</p>
        <h1 className="text-[30px]">Explore</h1>
        <p className="mt-1 max-w-[62ch] text-[14.5px] text-slate">
          Find a city or a thing to do, then send it straight to one of your trips.
        </p>
      </header>

      <div className="mb-4 flex gap-1 border-b">
        {(['cities', 'activities'] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => { setTab(key); setMaxCost(''); }}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[14px] font-medium capitalize transition-colors ${
              tab === key ? 'border-route text-route' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {key === 'cities' ? 'City search' : 'Activity search'}
          </button>
        ))}
      </div>

      <ControlStrip
        query={query}
        onQuery={setQuery}
        placeholder={tab === 'cities' ? 'Search cities by name, country or region…' : 'Search activities — paragliding, food tour, museum…'}
        groupBy={tab === 'cities' ? group : undefined}
        onGroupBy={setGroup}
        groupOptions={tab === 'cities' ? [
          { value: 'none', label: 'Nothing' },
          { value: 'region', label: 'Region' },
          { value: 'country', label: 'Country' },
        ] : undefined}
        sortBy={sort}
        onSortBy={setSort}
        sortOptions={
          tab === 'cities'
            ? [
                { value: 'popularity', label: 'Popularity' },
                { value: 'cost-low', label: 'Cheapest day' },
                { value: 'cost-high', label: 'Priciest day' },
                { value: 'name', label: 'Name' },
                { value: 'country', label: 'Country' },
              ]
            : [
                { value: 'popularity', label: 'Popularity' },
                { value: 'cost-low', label: 'Cheapest' },
                { value: 'cost-high', label: 'Priciest' },
                { value: 'duration', label: 'Shortest' },
                { value: 'name', label: 'Name' },
              ]
        }
        filterCount={filterCount}
        filterPanel={
          <div className="grid gap-3 sm:grid-cols-3">
            {tab === 'cities' ? (
              <>
                <Fieldset label="Region">
                  <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                    <option value="">Anywhere</option>
                    {facets?.regions.map((r: any) => <option key={r.region} value={r.region}>{r.region} ({r.n})</option>)}
                  </Select>
                </Fieldset>
                <Fieldset label="Country">
                  <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="">Any country</option>
                    {facets?.countries.map((c: any) => <option key={c.country} value={c.country}>{c.country} ({c.n})</option>)}
                  </Select>
                </Fieldset>
                <Fieldset label="Daily cost at most">
                  <Select value={maxCost} onChange={(e) => setMaxCost(e.target.value)}>
                    <option value="">Any budget</option>
                    {[40, 60, 80, 100, 130].map((v) => <option key={v} value={v}>{currency(v)} a day</option>)}
                  </Select>
                </Fieldset>
              </>
            ) : (
              <>
                <Fieldset label="Type">
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Anything</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Fieldset>
                <Fieldset label="Cost at most">
                  <Select value={maxCost} onChange={(e) => setMaxCost(e.target.value)}>
                    <option value="">Any price</option>
                    <option value="0">Free</option>
                    {[15, 30, 50, 100].map((v) => <option key={v} value={v}>{currency(v)}</option>)}
                  </Select>
                </Fieldset>
                <Fieldset label="Time at most">
                  <Select value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)}>
                    <option value="">Any length</option>
                    {[60, 120, 180, 300].map((v) => <option key={v} value={v}>{duration(v)}</option>)}
                  </Select>
                </Fieldset>
              </>
            )}
            {filterCount > 0 && (
              <button
                onClick={() => { setCountry(''); setRegion(''); setMaxCost(''); setCategory(''); setMaxDuration(''); }}
                className="self-end justify-self-start text-[12.5px] text-slate underline-offset-2 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        }
      />

      {error && <div className="mb-4"><Notice>{error}</Notice></div>}

      {tab === 'cities' ? (
        cities === null ? <Spinner label="Searching cities" />
        : cities.length === 0 ? <Empty title="No city matches" body="Widen the budget, clear a filter, or try a different spelling." />
        : grouped ? (
          <div className="space-y-7">
            {grouped.map(([label, list]) => (
              <section key={label}>
                <div className="mb-2.5 flex items-baseline gap-3">
                  <h2 className="text-[18px]">{label}</h2>
                  <span className="num text-[12.5px] text-mist">{list.length}</span>
                  <span className="h-px flex-1 bg-rule" />
                </div>
                <CityGrid cities={list} saved={saved} onSave={toggleSave} onAdd={(city) => setAdding({ city })} />
              </section>
            ))}
          </div>
        ) : (
          <>
            <p className="eyebrow mb-2.5">Results — {cities.length}</p>
            <CityGrid cities={cities} saved={saved} onSave={toggleSave} onAdd={(city) => setAdding({ city })} />
          </>
        )
      ) : activities === null ? <Spinner label="Searching activities" />
      : activities.length === 0 ? <Empty title="Nothing to do here" body="Loosen the filters or search for a different kind of activity." />
      : (
        <>
          <p className="eyebrow mb-2.5">Results — {activities.length}</p>
          <ul className="space-y-2">
            {activities.map((activity) => {
              const tone = categoryTone[activity.category];
              return (
                <li key={activity.id} className="card flex items-center gap-3 p-3">
                  <Plate name={activity.name} ratio="" className="hidden h-14 w-[86px] shrink-0 sm:block" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold">{activity.name}</p>
                    <p className="line-clamp-1 text-[13px] text-slate">{activity.description}</p>
                    <p className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-mist">
                      <span className="rounded-full px-1.5 py-0.5" style={{ color: tone.fg, background: tone.bg }}>{activity.category}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={10} />{activity.city_name}, {activity.country}</span>
                      <span className="inline-flex items-center gap-1"><Clock size={10} />{duration(activity.duration_minutes)}</span>
                      <span className="inline-flex items-center gap-1"><Wallet size={10} />{Number(activity.cost) === 0 ? 'Free' : currency(activity.cost)}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => setAdding({ activity })}>
                    <Plus size={13} /> <span className="hidden sm:inline">Add to trip</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AddToTripModal target={adding} onClose={() => setAdding(null)} />
    </div>
  );
}

function CityGrid({ cities, saved, onSave, onAdd }: {
  cities: City[]; saved: Set<number>; onSave: (city: City) => void; onAdd: (city: City) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => (
        <li key={city.id} className="card overflow-hidden">
          <div className="relative">
            <Plate name={city.name} ratio="aspect-[16/9]" label={city.region} className="rounded-b-none" />
            <button
              onClick={() => onSave(city)}
              className="absolute right-2 top-2 rounded-full bg-surface/90 p-1.5 text-slate shadow-sm hover:text-route"
              aria-label={saved.has(city.id) ? `Remove ${city.name} from saved` : `Save ${city.name}`}
            >
              {saved.has(city.id) ? <BookmarkCheck size={15} className="text-route" /> : <Bookmark size={15} />}
            </button>
          </div>

          <div className="p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate text-[17px]">{city.name}</h3>
              <span className="num shrink-0 text-[12px] text-mist">{currency(city.cost_index)}/day</span>
            </div>
            <p className="truncate text-[12.5px] text-slate">{city.country}</p>
            <p className="mt-2 line-clamp-2 text-[13px] text-slate">{city.description}</p>

            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
              <span className="num text-[12px] text-mist">{city.activity_count ?? 0} things to do</span>
              <Button size="sm" onClick={() => onAdd(city)}><Plus size={13} /> Add to trip</Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One modal handles both "add a city as a stop" and "add an activity to a stop". */
function AddToTripModal({ target, onClose }: { target: { city?: City; activity?: Activity } | null; onClose: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState('');
  const [stopId, setStopId] = useState('');
  const [detail, setDetail] = useState<Trip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!target) return;
    setError(''); setDone(''); setTripId(''); setStopId(''); setDetail(null);
    api.get('/trips').then(({ data }) => setTrips(data.trips)).catch(() => setTrips([]));
  }, [target]);

  useEffect(() => {
    if (!tripId) { setDetail(null); return; }
    api.get(`/trips/${tripId}`).then(({ data }) => {
      setDetail(data.trip);
      // For an activity, default to the stop already in that city.
      const match = target?.activity
        ? data.trip.stops.find((s: any) => s.city_id === target.activity!.city_id)
        : null;
      setStopId(match ? String(match.id) : '');
    }).catch(() => setDetail(null));
  }, [tripId]);

  if (!target) return null;
  const { city, activity } = target;

  async function add() {
    setBusy(true); setError('');
    try {
      if (city) {
        await api.post(`/trips/${tripId}/stops`, { cityId: city.id });
        setDone(`${city.name} is now a stop on that trip.`);
      } else if (activity && stopId) {
        const stop = detail!.stops.find((s) => String(s.id) === stopId)!;
        await api.post(`/trips/${tripId}/stops/${stopId}/activities`, {
          activityId: activity.id, scheduledDate: stop.start_date,
        });
        setDone(`${activity.name} is on the plan for ${stop.city_name}.`);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const needsStop = Boolean(activity);
  const canAdd = Boolean(tripId) && (!needsStop || Boolean(stopId));

  return (
    <Modal open onClose={onClose} title={city ? `Add ${city.name} to a trip` : `Add ${activity!.name} to a trip`}>
      <div className="space-y-3">
        {trips.length === 0 ? (
          <Empty title="No trips to add to" body="Create a trip first, then come back and add this to it." />
        ) : (
          <>
            <Fieldset label="Which trip">
              <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">Choose a trip…</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>{trip.name} — {trip.start_date}</option>
                ))}
              </Select>
            </Fieldset>

            {needsStop && detail && (
              detail.stops.length === 0 ? (
                <Notice tone="sand">
                  That trip has no stops yet. Add {activity!.city_name} as a stop first, then attach the activity.
                </Notice>
              ) : (
                <Fieldset label="Which stop" hint={`Best fit: ${activity!.city_name}`}>
                  <Select value={stopId} onChange={(e) => setStopId(e.target.value)}>
                    <option value="">Choose a stop…</option>
                    {detail.stops.map((stop) => (
                      <option key={stop.id} value={stop.id}>{stop.city_name} — {stop.start_date}</option>
                    ))}
                  </Select>
                </Fieldset>
              )
            )}

            {error && <Notice>{error}</Notice>}
            {done && <Notice tone="sea">{done}</Notice>}

            <Button variant="primary" busy={busy} disabled={!canAdd} onClick={add} className="w-full">
              <Plus size={15} /> Add it
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
