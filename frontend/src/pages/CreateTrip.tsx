import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Plus, Sparkles } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { currency, isoLocal } from '../lib/format';
import type { Activity, City } from '../lib/types';
import { Plate } from '../components/Plate';
import { Button, Fieldset, Input, Notice, Select, Textarea } from '../components/ui';

/** Today plus n days, as a local 'YYYY-MM-DD'. */
function dayFromNow(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoLocal(d);
}

export default function CreateTrip() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(dayFromNow(14));
  const [endDate, setEndDate] = useState(dayFromNow(21));
  const [travellers, setTravellers] = useState(1);
  const [firstCity, setFirstCity] = useState<City | null>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [suggestions, setSuggestions] = useState<Activity[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/cities', { params: { q: search || undefined, limit: 8, sort: 'popularity' } })
      .then(({ data }) => setCities(data.cities))
      .catch(() => setCities([]));
  }, [search]);

  useEffect(() => {
    if (!firstCity) { setSuggestions([]); return; }
    api.get('/activities', { params: { cityId: firstCity.id, limit: 6, sort: 'popularity' } })
      .then(({ data }) => setSuggestions(data.activities))
      .catch(() => setSuggestions([]));
  }, [firstCity]);

  const nights = useMemo(() => {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    return Math.max(0, Math.round((b - a) / 86400000));
  }, [startDate, endDate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (endDate < startDate) { setError('The end date has to come after the start date.'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/trips', { name, description, startDate, endDate, travellers });
      const tripId = data.trip.id;

      // A trip that starts with a city is a trip you can keep building.
      if (firstCity) {
        await api.post(`/trips/${tripId}/stops`, { cityId: firstCity.id, startDate, endDate });
      }
      navigate(`/trips/${tripId}/build`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">New trip</p>
        <h1 className="text-[30px]">Plan a new trip</h1>
        <p className="mt-1 max-w-[60ch] text-[14.5px] text-slate">
          Name it, set the dates, and pick where you land first. You add the rest of the stops next.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {/* ------------------------------------------------------ the form */}
        <div className="card rise space-y-4 p-5">
          <Fieldset label="Trip name">
            <Input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Iberian coast by rail"
            />
          </Fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Fieldset label="Start date">
              <Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Fieldset>
            <Fieldset label="End date" hint={`${nights} nights`}>
              <Input required type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Fieldset>
          </div>

          <Fieldset label="Travellers" hint="Costs multiply by this">
            <Select value={travellers} onChange={(e) => setTravellers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'traveller' : 'travellers'}</option>
              ))}
            </Select>
          </Fieldset>

          <Fieldset label="Description" hint="optional">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this trip is for, and anything the plan has to work around."
            />
          </Fieldset>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium">Select a place</span>
              <span className="eyebrow">First stop, optional</span>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities by name or country…"
              type="search"
            />

            <div className="rail mt-2 max-h-[190px] overflow-y-auto rounded-[10px] border">
              {cities.length === 0 && <p className="px-3 py-4 text-[13px] text-mist">No city matches that search.</p>}
              {cities.map((city) => {
                const selected = firstCity?.id === city.id;
                return (
                  <button
                    type="button"
                    key={city.id}
                    onClick={() => setFirstCity(selected ? null : city)}
                    className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 transition-colors ${
                      selected ? 'bg-route-soft' : 'hover:bg-canvas'
                    }`}
                  >
                    <MapPin size={14} className={selected ? 'text-route' : 'text-mist'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{city.name}</span>
                      <span className="block truncate text-[12px] text-slate">{city.country} · {city.region}</span>
                    </span>
                    <span className="num shrink-0 text-[12px] text-mist">{currency(city.cost_index)}/day</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <Notice>{error}</Notice>}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="submit" variant="primary" busy={busy}>
              Save and build the itinerary <ArrowRight size={15} />
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </div>

        {/* ------------------------------------------- suggestions and preview */}
        <aside className="space-y-4">
          <div className="card overflow-hidden">
            <Plate name={firstCity?.name ?? (name || 'New trip')} ratio="aspect-[16/7]" label={firstCity?.region} />
            <div className="p-4">
              <h2 className="truncate text-[18px]">{name || 'Untitled trip'}</h2>
              <p className="num mt-0.5 text-[12.5px] text-mist">
                {nights + 1} days · {travellers} {travellers === 1 ? 'traveller' : 'travellers'}
                {firstCity && ` · starts in ${firstCity.name}`}
              </p>
              {firstCity && (
                <p className="mt-3 border-t pt-3 text-[13px] text-slate">{firstCity.description}</p>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-[15px]">
              <Sparkles size={14} className="text-route" />
              {firstCity ? `Things to do in ${firstCity.name}` : 'Suggestions'}
            </h3>
            <p className="mb-3 text-[12.5px] text-slate">
              {firstCity
                ? 'Add these to the day plan once the trip is saved.'
                : 'Pick a first city and the most popular activities there show up here.'}
            </p>

            {suggestions.length === 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-[10px] border border-dashed bg-canvas/60" />
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3 rounded-[10px] border p-2.5">
                    <Plate name={activity.name} ratio="" className="h-11 w-11 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{activity.name}</p>
                      <p className="num text-[11.5px] text-mist">
                        {currency(activity.cost)} · {Math.round(activity.duration_minutes / 60)}h · {activity.category}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
