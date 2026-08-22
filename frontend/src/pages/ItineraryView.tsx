import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarRange, Clock, LayoutList, Plus, Wallet } from 'lucide-react';
import { useTrip } from '../lib/useTrip';
import { categoryTone, currency, dayName, duration, eachDate, shortDate, stopForDate } from '../lib/format';
import type { Trip, TripActivity } from '../lib/types';
import { TripHeader } from '../components/TripHeader';
import { Plate } from '../components/Plate';
import { Button, Empty, Notice, Spinner } from '../components/ui';

interface Day {
  date: string;
  stop: Trip['stops'][number] | null;
  activities: TripActivity[];
  spend: number;
}

/** Split the trip into one entry per calendar day, tagged with the stop. */
function buildDays(trip: Trip): Day[] {
  return eachDate(trip.start_date, trip.end_date).map((date) => {
    const activities = trip.stops
      .flatMap((s) => s.activities)
      .filter((a) => a.scheduled_date === date)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '') || a.position - b.position);

    return {
      date,
      stop: stopForDate(trip.stops, date),
      activities,
      spend: activities.reduce((sum, a) => sum + Number(a.cost), 0) * trip.travellers,
    };
  });
}

export default function ItineraryView() {
  const { id } = useParams();
  const { trip, setTrip, error } = useTrip(id);
  const [mode, setMode] = useState<'list' | 'calendar'>('list');

  const days = useMemo(() => (trip ? buildDays(trip) : []), [trip]);

  if (error) return <Notice>{error}</Notice>;
  if (!trip) return <Spinner label="Loading the itinerary" />;

  const heavy = new Set(trip.budget.heavyDays.map((d) => d.date));

  return (
    <div>
      <TripHeader trip={trip} onChange={setTrip} />

      {trip.stops.length === 0 ? (
        <Empty
          title="This trip has no stops yet"
          body="Open the build tab, add the cities you want to reach, and the day plan appears here."
          action={<Link to={`/trips/${trip.id}/build`}><Button variant="primary"><Plus size={15} /> Build the itinerary</Button></Link>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[21px]">Day by day</h2>
              <p className="text-[13px] text-slate">
                {trip.days} days across {trip.stops.length} {trip.stops.length === 1 ? 'city' : 'cities'}.
                {trip.budget.heavyDays.length > 0 &&
                  ` ${trip.budget.heavyDays.length} ${trip.budget.heavyDays.length === 1 ? 'day costs' : 'days cost'} well above average.`}
              </p>
            </div>

            <div className="flex rounded-[10px] border bg-surface p-0.5">
              {([['list', LayoutList, 'List'], ['calendar', CalendarRange, 'Calendar']] as const).map(([key, Icon, label]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
                    mode === key ? 'bg-route-soft text-route' : 'text-slate hover:text-ink'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'list' ? (
            <ListView trip={trip} days={days} heavy={heavy} />
          ) : (
            <CalendarView trip={trip} days={days} heavy={heavy} />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- list view
   The wireframe puts the plan on the left and the expense on the right, so
   the cost of a day is readable without opening the budget screen.        */

function ListView({ trip, days, heavy }: { trip: Trip; days: Day[]; heavy: Set<string> }) {
  let stopNumber = 0;
  let lastStopId = -1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_270px] lg:items-start">
      <ol className="spine space-y-2">
        {days.map((day, index) => {
          const newStop = day.stop && day.stop.id !== lastStopId;
          if (newStop) { stopNumber += 1; lastStopId = day.stop!.id; }

          return (
            <li key={day.date}>
              {newStop && day.stop && (
                <div className="relative mb-2 mt-5 first:mt-0">
                  <span className="spine-node" style={{ top: 4 }}>{stopNumber}</span>
                  <div className="flex items-center gap-3">
                    <Plate name={day.stop.city_name} ratio="" className="h-10 w-10 shrink-0" />
                    <div>
                      <h3 className="text-[19px] leading-tight">{day.stop.city_name}</h3>
                      <p className="num text-[12px] text-mist">
                        {day.stop.country} · {day.stop.nights} {day.stop.nights === 1 ? 'night' : 'nights'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`card relative overflow-hidden ${heavy.has(day.date) ? 'border-sand' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="eyebrow">Day {index + 1}</span>
                    <span className="text-[14.5px] font-semibold">{dayName(day.date)}</span>
                    {!day.stop && <span className="eyebrow text-sand">No stop covers this day</span>}
                  </div>
                  <span className={`num text-[13px] font-semibold ${heavy.has(day.date) ? 'text-sand' : 'text-slate'}`}>
                    {currency(day.spend)}
                    {heavy.has(day.date) && <span className="eyebrow ml-1.5">over average</span>}
                  </span>
                </div>

                {day.activities.length === 0 ? (
                  <p className="px-4 py-4 text-[13px] text-mist">
                    Nothing planned. A day with room in it is not a wasted day.
                  </p>
                ) : (
                  <ul>
                    {day.activities.map((activity) => {
                      const tone = categoryTone[activity.category];
                      return (
                        <li key={activity.id} className="flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0">
                          <span className="num w-11 shrink-0 pt-0.5 text-[12px] text-mist">
                            {activity.start_time ? activity.start_time.slice(0, 5) : '—'}
                          </span>
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone.fg }} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14.5px] font-medium">{activity.title}</span>
                            <span className="num flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-mist">
                              <span className="rounded-full px-1.5" style={{ color: tone.fg, background: tone.bg }}>
                                {activity.category}
                              </span>
                              <span className="inline-flex items-center gap-1"><Clock size={10} />{duration(activity.duration_minutes)}</span>
                            </span>
                            {activity.notes && <span className="mt-1 block text-[12.5px] text-slate">{activity.notes}</span>}
                          </span>
                          <span className="num w-16 shrink-0 text-right text-[13.5px] font-semibold">
                            {currency(Number(activity.cost) * trip.travellers)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <BudgetAside trip={trip} />
    </div>
  );
}

function BudgetAside({ trip }: { trip: Trip }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-20">
      <div className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[16px]">Trip budget</h3>
          <Link to={`/trips/${trip.id}/budget`} className="text-[12.5px] font-medium text-route hover:underline">Break it down</Link>
        </div>
        <p className="num mt-1 text-[27px] font-semibold leading-tight">{currency(trip.budget.total)}</p>
        <p className="num text-[12px] text-mist">
          {currency(trip.budget.perTraveller)} each · {currency(trip.budget.averagePerDay)} a day
        </p>

        <ul className="mt-3 space-y-2 border-t pt-3">
          {trip.budget.breakdown.map((line) => {
            const share = trip.budget.total ? (line.amount / trip.budget.total) * 100 : 0;
            return (
              <li key={line.category}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="capitalize text-slate">
                    {line.category}
                    {line.estimated && <span className="eyebrow ml-1.5">est</span>}
                  </span>
                  <span className="num font-medium">{currency(line.amount)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-sunk">
                  <div className="h-full rounded-full bg-route" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {trip.budget.heavyDays.length > 0 && (
        <div className="card border-sand p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-[15px]"><Wallet size={14} className="text-sand" /> Heavy days</h3>
          <p className="mb-2.5 text-[12.5px] text-slate">
            These cost more than half again a typical day of {currency(trip.budget.dailyAverage)}.
          </p>
          <ul className="space-y-1">
            {trip.budget.heavyDays.map((day) => (
              <li key={day.date} className="num flex justify-between text-[13px]">
                <span className="text-slate">{shortDate(day.date)}</span>
                <span className="font-semibold text-sand">{currency(day.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/* --------------------------------------------------------- calendar view */

function CalendarView({ trip, days, heavy }: { trip: Trip; days: Day[]; heavy: Set<string> }) {
  const first = new Date(`${trip.start_date}T00:00:00`);
  // Monday-first grid: pad the leading days so columns line up with weekdays.
  const lead = (first.getDay() + 6) % 7;
  const cells: (Day | null)[] = [...Array.from({ length: lead }, () => null), ...days];

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-canvas/60">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <span key={label} className="eyebrow px-2 py-2 text-center">{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) =>
          day === null ? (
            <div key={`pad-${index}`} className="min-h-[104px] border-b border-r bg-canvas/30 last:border-r-0" />
          ) : (
            <div
              key={day.date}
              className={`min-h-[104px] border-b border-r p-1.5 last:border-r-0 ${heavy.has(day.date) ? 'bg-sand-soft/50' : ''}`}
            >
              <div className="mb-1 flex items-baseline justify-between gap-1">
                <span className="num text-[12px] font-semibold">{Number(day.date.slice(8, 10))}</span>
                {day.spend > 0 && <span className="num text-[10px] text-mist">{currency(day.spend)}</span>}
              </div>

              {day.stop && (
                <p className="mb-1 truncate rounded bg-route-soft px-1.5 py-0.5 text-[10.5px] font-medium text-route">
                  {day.stop.city_name}
                </p>
              )}

              <ul className="space-y-0.5">
                {day.activities.slice(0, 3).map((activity) => {
                  const tone = categoryTone[activity.category];
                  return (
                    <li
                      key={activity.id}
                      title={`${activity.title} — ${currency(activity.cost)}`}
                      className="truncate rounded px-1.5 py-0.5 text-[10.5px]"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {activity.start_time && <span className="num mr-1">{activity.start_time.slice(0, 5)}</span>}
                      {activity.title}
                    </li>
                  );
                })}
                {day.activities.length > 3 && (
                  <li className="num px-1.5 text-[10px] text-mist">+{day.activities.length - 3} more</li>
                )}
              </ul>
            </div>
          )
        )}
      </div>
    </div>
  );
}
