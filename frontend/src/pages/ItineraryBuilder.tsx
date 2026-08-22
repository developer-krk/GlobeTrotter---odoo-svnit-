import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronDown, Clock, MapPin, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useTrip } from '../lib/useTrip';
import { currency, categoryTone, CATEGORIES, dateRange, duration, eachDate, shortDate } from '../lib/format';
import type { Activity, City, Stop, Trip } from '../lib/types';
import { TripHeader } from '../components/TripHeader';
import { Plate } from '../components/Plate';
import { Button, Empty, Fieldset, Input, Modal, Notice, Select, Spinner, Textarea } from '../components/ui';

export default function ItineraryBuilder() {
  const { id } = useParams();
  const { trip, setTrip, error, setError } = useTrip(id);

  const [addStopOpen, setAddStopOpen] = useState(false);
  const [activityFor, setActivityFor] = useState<Stop | null>(null);
  const [costOpen, setCostOpen] = useState(false);

  if (error) return <Notice>{error}</Notice>;
  if (!trip) return <Spinner label="Loading the itinerary" />;

  /** Every write returns the whole trip, so one setter keeps the screen true. */
  const apply = (next: Trip) => setTrip(next);

  async function move(stop: Stop, direction: -1 | 1) {
    const order = trip!.stops.map((s) => s.id);
    const from = order.indexOf(stop.id);
    const to = from + direction;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    try {
      const { data } = await api.post(`/trips/${trip!.id}/stops/reorder`, { order });
      apply(data.trip);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function removeStop(stop: Stop) {
    try {
      const { data } = await api.delete(`/trips/${trip!.id}/stops/${stop.id}`);
      apply(data.trip);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function patchStop(stop: Stop, patch: Record<string, unknown>) {
    try {
      const { data } = await api.patch(`/trips/${trip!.id}/stops/${stop.id}`, patch);
      apply(data.trip);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function removeActivity(activityId: number) {
    try {
      const { data } = await api.delete(`/trips/${trip!.id}/activities/${activityId}`);
      apply(data.trip);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div>
      <TripHeader trip={trip} onChange={apply} />

      <div className="grid gap-5 lg:grid-cols-[1fr_290px] lg:items-start">
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[21px]">Stops</h2>
              <p className="text-[13px] text-slate">Each stop is one city with its own dates, activities and costs.</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setAddStopOpen(true)}>
              <Plus size={14} /> Add stop
            </Button>
          </div>

          {trip.stops.length === 0 ? (
            <Empty
              title="No stops on this trip yet"
              body="Add the first city you land in. GlobeTrotter fills in the dates from the trip, and you adjust them from there."
              action={<Button variant="primary" onClick={() => setAddStopOpen(true)}><Plus size={15} /> Add the first stop</Button>}
            />
          ) : (
            <ol className="spine space-y-3">
              {trip.stops.map((stop, index) => (
                <StopSection
                  key={stop.id}
                  stop={stop}
                  index={index}
                  total={trip.stops.length}
                  travellers={trip.travellers}
                  onMove={move}
                  onRemove={removeStop}
                  onPatch={patchStop}
                  onAddActivity={() => setActivityFor(stop)}
                  onRemoveActivity={removeActivity}
                />
              ))}
            </ol>
          )}
        </div>

        <BuilderSidebar trip={trip} onAddCost={() => setCostOpen(true)} onChange={apply} />
      </div>

      <AddStopModal
        open={addStopOpen}
        onClose={() => setAddStopOpen(false)}
        trip={trip}
        onAdded={apply}
      />
      <AddActivityModal
        stop={activityFor}
        trip={trip}
        onClose={() => setActivityFor(null)}
        onAdded={apply}
      />
      <AddCostModal open={costOpen} onClose={() => setCostOpen(false)} trip={trip} onAdded={apply} />
    </div>
  );
}

/* ------------------------------------------------------------- one stop */

function StopSection({ stop, index, total, travellers, onMove, onRemove, onPatch, onAddActivity, onRemoveActivity }: {
  stop: Stop; index: number; total: number; travellers: number;
  onMove: (stop: Stop, direction: -1 | 1) => void;
  onRemove: (stop: Stop) => void;
  onPatch: (stop: Stop, patch: Record<string, unknown>) => void;
  onAddActivity: () => void;
  onRemoveActivity: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const spend = stop.activities.reduce((sum, a) => sum + Number(a.cost), 0) * travellers;

  return (
    <li className="card relative">
      <span className="spine-node" style={{ top: 18 }}>{index + 1}</span>

      <div className="flex flex-wrap items-start gap-3 p-4">
        <Plate name={stop.city_name} ratio="" className="hidden h-14 w-14 shrink-0 sm:block" />

        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-0.5">Stop {index + 1} of {total} · {stop.region}</p>
          <h3 className="truncate text-[18px]">{stop.city_name}</h3>
          <p className="num text-[12.5px] text-slate">
            {stop.country} · {dateRange(stop.start_date, stop.end_date)} · {stop.nights} {stop.nights === 1 ? 'night' : 'nights'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onMove(stop, -1)} disabled={index === 0} aria-label="Move earlier">
            <ArrowUp size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMove(stop, 1)} disabled={index === total - 1} aria-label="Move later">
            <ArrowDown size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRemove(stop)} aria-label="Remove stop" className="text-flag hover:bg-flag-soft">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
        <Fieldset label="Date range">
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={stop.start_date}
              onChange={(e) => onPatch(stop, { startDate: e.target.value })}
              className="text-[13px]"
            />
            <span className="text-mist">to</span>
            <Input
              type="date"
              min={stop.start_date}
              value={stop.end_date}
              onChange={(e) => onPatch(stop, { endDate: e.target.value })}
              className="text-[13px]"
            />
          </div>
        </Fieldset>

        <Fieldset label="Notes for this stop" hint="optional">
          <Input
            defaultValue={stop.notes ?? ''}
            onBlur={(e) => e.target.value !== (stop.notes ?? '') && onPatch(stop, { notes: e.target.value })}
            placeholder="Where you sleep, who you meet, what to book first."
            className="text-[13px]"
          />
        </Fieldset>

        <div className="self-end">
          <p className="eyebrow mb-1">Activities</p>
          <p className="num text-[15px] font-semibold">{currency(spend)}</p>
        </div>
      </div>

      <div className="border-t">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-slate hover:text-ink"
          aria-expanded={open}
        >
          <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
          {stop.activities.length} {stop.activities.length === 1 ? 'activity' : 'activities'} planned
        </button>

        {open && (
          <div className="px-4 pb-4">
            {stop.activities.length === 0 ? (
              <p className="rounded-[10px] border border-dashed px-3 py-4 text-center text-[13px] text-mist">
                Nothing planned here yet.
              </p>
            ) : (
              <ul className="day-rail space-y-1.5">
                {stop.activities.map((activity) => {
                  const tone = categoryTone[activity.category];
                  return (
                    <li key={activity.id} className="relative flex items-center gap-3 rounded-[10px] border bg-canvas/40 px-3 py-2">
                      <span className="day-tick" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{activity.title}</span>
                        <span className="num block text-[11.5px] text-mist">
                          {shortDate(activity.scheduled_date)}
                          {activity.start_time && ` · ${activity.start_time.slice(0, 5)}`}
                          {` · ${duration(activity.duration_minutes)}`}
                        </span>
                      </span>
                      <span
                        className="num hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline"
                        style={{ color: tone.fg, background: tone.bg }}
                      >
                        {activity.category}
                      </span>
                      <span className="num w-16 shrink-0 text-right text-[13px] font-semibold">
                        {currency(Number(activity.cost) * travellers)}
                      </span>
                      <button
                        onClick={() => onRemoveActivity(activity.id)}
                        className="shrink-0 rounded p-1 text-mist hover:bg-flag-soft hover:text-flag"
                        aria-label={`Remove ${activity.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <Button size="sm" className="mt-3" onClick={onAddActivity}>
              <Plus size={13} /> Add an activity here
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/* --------------------------------------------------------------- sidebar */

function BuilderSidebar({ trip, onAddCost, onChange }: { trip: Trip; onAddCost: () => void; onChange: (trip: Trip) => void }) {
  async function removeCost(costId: number) {
    const { data } = await api.delete(`/trips/${trip.id}/costs/${costId}`);
    onChange(data.trip);
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-20">
      <div className="card p-4">
        <h3 className="mb-1 text-[16px]">Running total</h3>
        <p className="num text-[27px] font-semibold leading-tight">{currency(trip.budget.total)}</p>
        <p className="num text-[12px] text-mist">
          {currency(trip.budget.averagePerDay)} a day · {trip.budget.days} days
        </p>

        <ul className="mt-3 space-y-1.5 border-t pt-3">
          {trip.budget.breakdown.map((line) => (
            <li key={line.category} className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="capitalize text-slate">
                {line.category}
                {line.estimated && <span className="eyebrow ml-1.5">est</span>}
              </span>
              <span className="num font-medium">{currency(line.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[16px]">Other costs</h3>
          <Button size="sm" variant="ghost" onClick={onAddCost} aria-label="Add a cost"><Plus size={14} /></Button>
        </div>
        <p className="mb-3 text-[12.5px] text-slate">
          Flights, hotels and anything else that is not an activity.
        </p>

        {trip.costs.length === 0 ? (
          <p className="rounded-[10px] border border-dashed px-3 py-3 text-center text-[12.5px] text-mist">
            No costs entered. Food is estimated from each city until you add your own.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {trip.costs.map((cost) => (
              <li key={cost.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{cost.label}</span>
                  <span className="eyebrow">{cost.category}</span>
                </span>
                <span className="num shrink-0 font-medium">{currency(cost.amount)}</span>
                <button
                  onClick={() => removeCost(cost.id)}
                  className="shrink-0 rounded p-1 text-mist hover:bg-flag-soft hover:text-flag"
                  aria-label={`Remove ${cost.label}`}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- modals */

function AddStopModal({ open, onClose, trip, onAdded }: {
  open: boolean; onClose: () => void; trip: Trip; onAdded: (trip: Trip) => void;
}) {
  const [search, setSearch] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState<City | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // A new stop starts the day the last one ends, so the route stays joined up.
    const last = trip.stops[trip.stops.length - 1];
    setStart(last ? last.end_date : trip.start_date);
    setEnd(last ? last.end_date : trip.end_date);
    setSelected(null);
    setError('');
  }, [open, trip]);

  useEffect(() => {
    if (!open) return;
    api.get('/cities', { params: { q: search || undefined, limit: 12 } })
      .then(({ data }) => setCities(data.cities))
      .catch(() => setCities([]));
  }, [search, open]);

  async function add() {
    if (!selected) { setError('Choose a city first.'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/trips/${trip.id}/stops`, {
        cityId: selected.id, startDate: start, endDate: end,
      });
      onAdded(data.trip);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a stop" wide>
      <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="relative mb-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities by name or country…"
              className="pl-9"
              type="search"
            />
          </div>

          <div className="rail max-h-[320px] overflow-y-auto rounded-[10px] border">
            {cities.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-mist">No city matches that.</p>}
            {cities.map((city) => (
              <button
                key={city.id}
                onClick={() => setSelected(city)}
                className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 ${
                  selected?.id === city.id ? 'bg-route-soft' : 'hover:bg-canvas'
                }`}
              >
                <MapPin size={14} className={selected?.id === city.id ? 'text-route' : 'text-mist'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{city.name}</span>
                  <span className="block truncate text-[12px] text-slate">{city.country} · {city.activity_count} things to do</span>
                </span>
                <span className="num shrink-0 text-[12px] text-mist">{currency(city.cost_index)}/day</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {selected ? (
            <div className="card overflow-hidden">
              <Plate name={selected.name} ratio="aspect-[16/8]" label={selected.region} />
              <div className="p-3">
                <h3 className="text-[16px]">{selected.name}</h3>
                <p className="text-[12.5px] text-slate">{selected.description}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed px-3 py-8 text-center text-[13px] text-mist">
              Pick a city to see the details.
            </div>
          )}

          <Fieldset label="Arrive">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Fieldset>
          <Fieldset label="Leave">
            <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Fieldset>

          {error && <Notice>{error}</Notice>}

          <Button variant="primary" busy={busy} onClick={add} className="w-full">
            <Plus size={15} /> Add this stop
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddActivityModal({ stop, trip, onClose, onAdded }: {
  stop: Stop | null; trip: Trip; onClose: () => void; onAdded: (trip: Trip) => void;
}) {
  const [tab, setTab] = useState<'catalogue' | 'custom'>('catalogue');
  const [catalogue, setCatalogue] = useState<Activity[]>([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState({ title: '', category: 'sightseeing', cost: '0', durationMinutes: '60', notes: '' });

  useEffect(() => {
    if (!stop) return;
    setDate(stop.start_date);
    setTab('catalogue');
    setError('');
    setSearch('');
  }, [stop]);

  useEffect(() => {
    if (!stop) return;
    api.get('/activities', { params: { cityId: stop.city_id, q: search || undefined, limit: 40 } })
      .then(({ data }) => setCatalogue(data.activities))
      .catch(() => setCatalogue([]));
  }, [stop, search]);

  if (!stop) return null;

  const days = eachDate(stop.start_date, stop.end_date);

  async function add(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/trips/${trip.id}/stops/${stop!.id}/activities`, {
        ...payload, scheduledDate: date, startTime: time ? `${time}:00` : null,
      });
      onAdded(data.trip);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add an activity in ${stop.city_name}`} wide>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Fieldset label="Which day">
          <Select value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => <option key={d} value={d}>{shortDate(d)}</option>)}
          </Select>
        </Fieldset>
        <Fieldset label="Start time" hint="optional">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Fieldset>
      </div>

      <div className="mb-3 flex gap-1 border-b">
        {(['catalogue', 'custom'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 pb-2 text-[13.5px] font-medium ${
              tab === key ? 'border-route text-route' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {key === 'catalogue' ? `Things to do in ${stop.city_name}` : 'Something of my own'}
          </button>
        ))}
      </div>

      {error && <div className="mb-3"><Notice>{error}</Notice></div>}

      {tab === 'catalogue' ? (
        <>
          <div className="relative mb-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter the list…" className="pl-9" type="search" />
          </div>

          <ul className="rail max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {catalogue.length === 0 && (
              <li className="rounded-[10px] border border-dashed px-3 py-6 text-center text-[13px] text-mist">
                Nothing in the catalogue matches. Use "Something of my own" instead.
              </li>
            )}
            {catalogue.map((activity) => {
              const tone = categoryTone[activity.category];
              return (
                <li key={activity.id} className="flex items-center gap-3 rounded-[10px] border p-2.5">
                  <Plate name={activity.name} ratio="" className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{activity.name}</p>
                    <p className="line-clamp-1 text-[12px] text-slate">{activity.description}</p>
                    <p className="num mt-0.5 flex items-center gap-2 text-[11.5px] text-mist">
                      <span className="rounded-full px-1.5" style={{ color: tone.fg, background: tone.bg }}>{activity.category}</span>
                      <span className="inline-flex items-center gap-1"><Clock size={10} />{duration(activity.duration_minutes)}</span>
                      <span className="inline-flex items-center gap-1"><Wallet size={10} />{currency(activity.cost)}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="primary" busy={busy} onClick={() => add({ activityId: activity.id })}>
                    <Plus size={13} /> Add
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="space-y-3">
          <Fieldset label="What is it">
            <Input
              value={custom.title}
              onChange={(e) => setCustom({ ...custom, title: e.target.value })}
              placeholder="Dinner with Ana, ferry to the island, rest day"
            />
          </Fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <Fieldset label="Category">
              <Select value={custom.category} onChange={(e) => setCustom({ ...custom, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Fieldset>
            <Fieldset label="Cost per person">
              <Input type="number" min="0" step="1" value={custom.cost} onChange={(e) => setCustom({ ...custom, cost: e.target.value })} />
            </Fieldset>
            <Fieldset label="Minutes">
              <Input type="number" min="15" step="15" value={custom.durationMinutes} onChange={(e) => setCustom({ ...custom, durationMinutes: e.target.value })} />
            </Fieldset>
          </div>
          <Fieldset label="Notes" hint="optional">
            <Textarea rows={2} value={custom.notes} onChange={(e) => setCustom({ ...custom, notes: e.target.value })} />
          </Fieldset>
          <Button
            variant="primary"
            busy={busy}
            className="w-full"
            onClick={() => add({
              title: custom.title,
              category: custom.category,
              cost: Number(custom.cost),
              durationMinutes: Number(custom.durationMinutes),
              notes: custom.notes,
            })}
          >
            <Plus size={15} /> Add to {shortDate(date)}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function AddCostModal({ open, onClose, trip, onAdded }: {
  open: boolean; onClose: () => void; trip: Trip; onAdded: (trip: Trip) => void;
}) {
  const [form, setForm] = useState({ category: 'transport', label: '', amount: '', stopId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/trips/${trip.id}/costs`, {
        category: form.category,
        label: form.label,
        amount: Number(form.amount) || 0,
        stopId: form.stopId ? Number(form.stopId) : null,
      });
      onAdded(data.trip);
      setForm({ category: 'transport', label: '', amount: '', stopId: '' });
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a cost">
      <div className="space-y-3">
        <Fieldset label="What kind">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="transport">Getting around — flights, trains, car hire</option>
            <option value="stay">Places to stay</option>
            <option value="meals">Food and daily spend</option>
            <option value="other">Everything else</option>
          </Select>
        </Fieldset>

        <Fieldset label="Label">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Return flights" />
        </Fieldset>

        <Fieldset label="Amount" hint="For the whole party">
          <Input type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="640" />
        </Fieldset>

        {trip.stops.length > 0 && (
          <Fieldset label="Tie it to a stop" hint="optional">
            <Select value={form.stopId} onChange={(e) => setForm({ ...form, stopId: e.target.value })}>
              <option value="">The whole trip</option>
              {trip.stops.map((s) => <option key={s.id} value={s.id}>{s.city_name}</option>)}
            </Select>
          </Fieldset>
        )}

        {error && <Notice>{error}</Notice>}

        <Button variant="primary" busy={busy} onClick={save} className="w-full">
          <Plus size={15} /> Add the cost
        </Button>
      </div>
    </Modal>
  );
}
