import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, CopyPlus, Eye, Wallet } from 'lucide-react';
import { api, errorText, getToken } from '../lib/api';
import { categoryTone, costLabel, costTone, currency, dateRange, dayName, duration, eachDate, stopForDate } from '../lib/format';
import type { Trip, TripActivity } from '../lib/types';
import { Brand } from '../components/Brand';
import { Avatar, Plate } from '../components/Plate';
import { Button, Notice, Spinner } from '../components/ui';

export default function PublicTrip() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    api.get(`/public/trips/${slug}`)
      .then(({ data }) => setTrip(data.trip))
      .catch((err) => setError(errorText(err)));
  }, [slug]);

  async function copyTrip() {
    if (!getToken()) {
      navigate('/login', { state: { from: `/s/${slug}` } });
      return;
    }
    setCopying(true);
    try {
      const { data } = await api.post(`/public/trips/${slug}/copy`);
      navigate(`/trips/${data.trip.id}/build`);
    } catch (err) {
      setError(errorText(err));
      setCopying(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  }

  if (error) {
    return (
      <PublicFrame>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="mb-2 text-[24px]">This itinerary is not available</h1>
          <p className="mb-5 text-[14px] text-slate">{error}</p>
          <Link to="/"><Button variant="primary">Go to GlobeTrotter</Button></Link>
        </div>
      </PublicFrame>
    );
  }
  if (!trip) return <PublicFrame><Spinner label="Loading the itinerary" /></PublicFrame>;

  const days: { date: string; stop: Trip['stops'][number] | null; activities: TripActivity[] }[] =
    eachDate(trip.start_date, trip.end_date).map((date) => ({
      date,
      stop: stopForDate(trip.stops, date),
      activities: trip.stops.flatMap((s) => s.activities).filter((a) => a.scheduled_date === date),
    }));

  return (
    <PublicFrame>
      <div className="mx-auto max-w-[900px]">
        <section className="card rise mb-6 overflow-hidden">
          <Plate name={trip.stops[0]?.city_name ?? trip.name} ratio="aspect-[16/5]" className="rounded-b-none" label={trip.stops[0]?.region} />

          <div className="p-5">
            <span className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-sunk px-2 py-1">
              <Eye size={10} /> Read-only itinerary
            </span>
            <h1 className="mt-2 text-[30px] leading-tight">{trip.name}</h1>
            {trip.description && <p className="mt-1.5 max-w-[70ch] text-[14.5px] text-slate">{trip.description}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
              <Avatar name={trip.owner_name ?? 'Traveller'} size={32} />
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium">{trip.owner_name}</p>
                <p className="num text-[12px] text-mist">
                  {dateRange(trip.start_date, trip.end_date)} · {trip.days} days · {trip.stops.length} cities
                </p>
              </div>

              <div className="ml-auto flex gap-2">
                <Button onClick={copyLink}>
                  {linkCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
                </Button>
                <Button variant="primary" busy={copying} onClick={copyTrip}>
                  <CopyPlus size={14} /> Copy this trip
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="card mb-6 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-[18px]"><Wallet size={15} className="text-route" /> What it costs</h2>
            <p className="num text-[22px] font-semibold">{currency(trip.budget.total)}</p>
          </div>
          <p className="num mb-3 text-[12.5px] text-mist">
            {currency(trip.budget.perTraveller)} each · {currency(trip.budget.averagePerDay)} a day · {trip.travellers} travelling
          </p>

          <div className="flex h-2.5 overflow-hidden rounded-full">
            {trip.budget.breakdown.map((line) => (
              <span
                key={line.category}
                className="border-r-2 border-surface last:border-r-0"
                style={{ width: `${(line.amount / trip.budget.total) * 100}%`, background: costTone[line.category] ?? costTone.other }}
              />
            ))}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {trip.budget.breakdown.map((line) => (
              <li key={line.category} className="flex items-center gap-2 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: costTone[line.category] ?? costTone.other }} />
                <span className="text-slate">{costLabel[line.category] ?? line.category}</span>
                <span className="num font-semibold">{currency(line.amount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <h2 className="mb-3 text-[21px]">The plan</h2>
        <ol className="spine space-y-2">
          {(() => {
            let stopNumber = 0;
            let lastStopId = -1;
            return days.map((day, index) => {
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
                          <p className="num text-[12px] text-mist">{day.stop.country} · {day.stop.nights} nights</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="card relative">
                    <div className="flex items-baseline justify-between border-b px-4 py-2.5">
                      <span className="text-[14.5px] font-semibold">{dayName(day.date)}</span>
                      <span className="eyebrow">Day {index + 1}</span>
                    </div>

                    {day.activities.length === 0 ? (
                      <p className="px-4 py-3.5 text-[13px] text-mist">Nothing planned.</p>
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
                                <span className="num text-[11.5px] text-mist">
                                  {activity.category} · {duration(activity.duration_minutes)}
                                </span>
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
            });
          })()}
        </ol>

        <div className="mt-8 flex flex-col items-center gap-3 border-t pt-8 text-center">
          <p className="text-[14px] text-slate">Want this trip in your own account, with the dates and costs to edit?</p>
          <Button variant="primary" busy={copying} onClick={copyTrip}><CopyPlus size={15} /> Copy this trip</Button>
        </div>
      </div>
    </PublicFrame>
  );
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-4">
          <Link to="/"><Brand /></Link>
          <Link to="/login"><Button size="sm">Sign in</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 py-8 pb-20">{children}</main>
    </div>
  );
}
