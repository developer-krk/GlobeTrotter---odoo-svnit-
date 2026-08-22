import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Wallet } from 'lucide-react';
import type { Trip, TripStatus } from '../lib/types';
import { currency, dateRange, relativeDays } from '../lib/format';
import { Plate } from './Plate';

const STATUS: Record<TripStatus, { label: string; fg: string; bg: string }> = {
  ongoing: { label: 'On the road', fg: '#0E8F87', bg: '#D8F0EE' },
  upcoming: { label: 'Upcoming', fg: '#2647E8', bg: '#E5E9FD' },
  completed: { label: 'Completed', fg: '#56697A', bg: '#E3E9ED' },
};

export function StatusPill({ status }: { status: TripStatus }) {
  const tone = STATUS[status];
  return (
    <span
      className="eyebrow inline-flex items-center gap-1.5 rounded-full px-2 py-1"
      style={{ color: tone.fg, background: tone.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
      {tone.label}
    </span>
  );
}

/** The route in miniature: dots for stops, a line for the legs between. */
export function RouteStrip({ route }: { route: { id: number; city: string }[] }) {
  if (route.length === 0) {
    return <span className="text-[13px] text-mist">No stops yet</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {route.map((stop, i) => (
        <span key={stop.id} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span className="h-px w-3 shrink-0 bg-rule" />}
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-route" />
          <span className="truncate text-[13px] text-ink">{stop.city}</span>
        </span>
      ))}
    </div>
  );
}

/** The wide "short over view of the trip" row from the trip list screen. */
export function TripCard({ trip }: { trip: Trip }) {
  const route = trip.route ?? trip.stops?.map((s) => ({ id: s.id, city: s.city_name })) ?? [];
  const cover = route[0]?.city ?? trip.name;

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="card group flex gap-4 p-3 transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(11,27,43,0.4)]"
    >
      <Plate name={cover} ratio="" className="hidden h-[104px] w-[150px] shrink-0 sm:block" label={route[0]?.city} />

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusPill status={trip.status} />
            <span className="eyebrow">{relativeDays(trip.start_date)}</span>
          </div>
          <h3 className="truncate text-[19px] group-hover:text-route">{trip.name}</h3>
          {trip.description && <p className="mt-0.5 line-clamp-1 text-[13.5px] text-slate">{trip.description}</p>}
        </div>

        <RouteStrip route={route} />

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate">
          <Meta icon={Calendar}>{dateRange(trip.start_date, trip.end_date)}</Meta>
          <Meta icon={MapPin}>{route.length} {route.length === 1 ? 'city' : 'cities'} · {trip.days} days</Meta>
          {trip.travellers > 1 && <Meta icon={Users}>{trip.travellers} travellers</Meta>}
          <Meta icon={Wallet}><span className="num font-semibold text-ink">{currency(trip.budget.total)}</span></Meta>
        </dl>
      </div>
    </Link>
  );
}

function Meta({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} className="text-mist" />
      {children}
    </span>
  );
}
