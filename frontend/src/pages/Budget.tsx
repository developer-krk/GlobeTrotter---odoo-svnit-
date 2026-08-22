import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Plus, Table2 } from 'lucide-react';
import { useTrip } from '../lib/useTrip';
import { costLabel, costTone, currency, shortDate } from '../lib/format';
import type { Trip } from '../lib/types';
import { TripHeader } from '../components/TripHeader';
import { Button, Empty, Notice, Spinner } from '../components/ui';

export default function Budget() {
  const { id } = useParams();
  const { trip, setTrip, error } = useTrip(id);
  const [showTable, setShowTable] = useState(false);

  // Day counts and food estimates come from the server, which owns the rule
  // about who gets a shared travel day. Recomputing them here would drift.
  const perStop = useMemo(() => {
    if (!trip) return [];
    return trip.stops.map((stop) => {
      const split = trip.budget.byStop.find((b) => b.stopId === stop.id);
      const activities = Math.round(stop.activities.reduce((sum, a) => sum + Number(a.cost), 0) * trip.travellers);
      const entered = Math.round(
        trip.costs.filter((c) => c.stop_id === stop.id).reduce((sum, c) => sum + Number(c.amount), 0)
      );
      const meals = split?.meals ?? 0;
      return {
        city: stop.city_name,
        days: split?.days ?? 0,
        activities,
        entered,
        meals,
        total: activities + entered + meals,
      };
    });
  }, [trip]);

  if (error) return <Notice>{error}</Notice>;
  if (!trip) return <Spinner label="Working out the budget" />;

  const { budget } = trip;

  if (budget.total === 0) {
    return (
      <div>
        <TripHeader trip={trip} onChange={setTrip} />
        <Empty
          title="Nothing costs anything yet"
          body="Add stops and activities, or enter what the flights and hotels cost, and the breakdown builds itself."
          action={<Link to={`/trips/${trip.id}/build`}><Button variant="primary"><Plus size={15} /> Build the itinerary</Button></Link>}
        />
      </div>
    );
  }

  const pieData = budget.breakdown.map((line) => ({
    name: costLabel[line.category] ?? line.category,
    key: line.category,
    value: line.amount,
    estimated: line.estimated,
  }));

  return (
    <div>
      <TripHeader trip={trip} onChange={setTrip} />

      {/* ------------------------------------------------------ headline */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Estimated total" value={currency(budget.total)} note={`${budget.days} days`} strong />
        <Tile label="Per traveller" value={currency(budget.perTraveller)} note={`${budget.travellers} ${budget.travellers === 1 ? 'person' : 'people'}`} />
        <Tile label="Average day" value={currency(budget.averagePerDay)} note="Across the whole trip" />
        <Tile
          label="Days above average"
          value={String(budget.heavyDays.length)}
          note={`Over ${currency(budget.threshold)}`}
          tone={budget.heavyDays.length ? 'sand' : undefined}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr] lg:items-start">
        {/* ------------------------------------------------ where it goes */}
        <section className="card p-5">
          <h2 className="text-[19px]">Where the money goes</h2>
          <p className="mb-3 text-[13px] text-slate">
            Food is estimated from each city's daily cost until you enter your own figure.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-[190px] w-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {pieData.map((slice) => (
                      <Cell key={slice.key} fill={costTone[slice.key] ?? costTone.other} />
                    ))}
                  </Pie>
                  <Tooltip content={<SliceTooltip total={budget.total} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* The legend is always present: identity is never colour alone. */}
            <ul className="w-full flex-1 space-y-2">
              {pieData.map((slice) => (
                <li key={slice.key} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: costTone[slice.key] ?? costTone.other }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate">
                    {slice.name}
                    {slice.estimated && <span className="eyebrow ml-1.5">est</span>}
                  </span>
                  <span className="num shrink-0 text-[13.5px] font-semibold">{currency(slice.value)}</span>
                  <span className="num w-9 shrink-0 text-right text-[11.5px] text-mist">
                    {Math.round((slice.value / budget.total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------- day by day */}
        <section className="card p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[19px]">Spend by day</h2>
            <button
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-route hover:underline"
            >
              <Table2 size={13} /> {showTable ? 'Show the chart' : 'Show the numbers'}
            </button>
          </div>
          <p className="mb-3 text-[13px] text-slate">
            Activities plus the daily cost of wherever you are that day. Flights and hotels are not spread across it,
            so a typical day here is {currency(budget.dailyAverage)}.
          </p>

          {showTable ? (
            <div className="rail max-h-[300px] overflow-y-auto rounded-[10px] border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-canvas">
                  <tr>
                    <th className="eyebrow px-3 py-2 text-left">Date</th>
                    <th className="eyebrow px-3 py-2 text-right">Spend</th>
                    <th className="eyebrow px-3 py-2 text-right">Vs a typical day</th>
                  </tr>
                </thead>
                <tbody>
                  {budget.daily.map((day) => {
                    const delta = day.amount - budget.dailyAverage;
                    return (
                      <tr key={day.date} className="border-t">
                        <td className="num px-3 py-1.5">{shortDate(day.date)}</td>
                        <td className="num px-3 py-1.5 text-right font-medium">{currency(day.amount)}</td>
                        <td className={`num px-3 py-1.5 text-right ${delta > 0 ? 'text-flag' : 'text-sea'}`}>
                          {delta > 0 ? '+' : ''}{currency(delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budget.daily} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => shortDate(d)}
                    tick={{ fontSize: 10.5, fill: 'var(--color-mist)', fontFamily: 'var(--font-mono)' }}
                    axisLine={{ stroke: 'var(--color-rule)' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={22}
                  />
                  <YAxis
                    tick={{ fontSize: 10.5, fill: 'var(--color-mist)', fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v ? `${v}` : '0')}
                    width={44}
                  />
                  <ReferenceLine
                    y={budget.dailyAverage}
                    stroke="var(--color-mist)"
                    strokeDasharray="3 3"
                    label={{ value: 'average', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-mist)' }}
                  />
                  <Tooltip cursor={{ fill: 'var(--color-sunk)' }} content={<DayTooltip average={budget.dailyAverage} />} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {budget.daily.map((day) => (
                      <Cell key={day.date} fill={day.amount > budget.threshold ? costTone.activities : costTone.transport} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {budget.heavyDays.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-sand/30 bg-sand-soft px-3 py-2.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-sand" />
              <p className="text-[13px] text-sand">
                <strong className="font-semibold">
                  {budget.heavyDays.length} {budget.heavyDays.length === 1 ? 'day costs' : 'days cost'} over {currency(budget.threshold)}
                </strong>{' '}
                — {budget.heavyDays.map((d) => shortDate(d.date)).join(', ')}. Move one activity to a quieter day to
                even it out.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------- by stop */}
      {perStop.length > 0 && (
        <section className="card mt-5 overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="text-[19px]">Cost by stop</h2>
            <p className="text-[13px] text-slate">What each city adds to the total.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b bg-canvas/60">
                  <th className="eyebrow px-5 py-2 text-left">City</th>
                  <th className="eyebrow px-3 py-2 text-right">Days</th>
                  <th className="eyebrow px-3 py-2 text-right">Activities</th>
                  <th className="eyebrow px-3 py-2 text-right">Entered costs</th>
                  <th className="eyebrow px-3 py-2 text-right">Food (est)</th>
                  <th className="eyebrow px-5 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {perStop.map((row) => (
                  <tr key={row.city} className="border-b last:border-b-0">
                    <td className="px-5 py-2.5 font-medium">{row.city}</td>
                    <td className="num px-3 py-2.5 text-right text-slate">{row.days}</td>
                    <td className="num px-3 py-2.5 text-right text-slate">{currency(row.activities)}</td>
                    <td className="num px-3 py-2.5 text-right text-slate">{currency(row.entered)}</td>
                    <td className="num px-3 py-2.5 text-right text-slate">{currency(row.meals)}</td>
                    <td className="num px-5 py-2.5 text-right font-semibold">{currency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, note, strong, tone }: {
  label: string; value: string; note: string; strong?: boolean; tone?: 'sand';
}) {
  return (
    <div className={`card p-4 ${tone === 'sand' ? 'border-sand' : ''}`}>
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1 font-semibold leading-tight ${strong ? 'text-[28px]' : 'text-[22px]'} ${tone === 'sand' ? 'text-sand' : ''}`}>
        {value}
      </p>
      <p className="text-[12px] text-mist">{note}</p>
    </div>
  );
}

function SliceTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="card px-3 py-2 shadow-[0_10px_28px_-14px_rgba(11,27,43,0.5)]">
      <p className="text-[13px] font-medium">{slice.name}</p>
      <p className="num text-[13px] text-slate">
        {currency(slice.value)} · {Math.round((slice.value / total) * 100)}% of the trip
      </p>
    </div>
  );
}

function DayTooltip({ active, payload, label, average }: any) {
  if (!active || !payload?.length) return null;
  const amount = payload[0].value as number;
  const delta = amount - average;
  return (
    <div className="card px-3 py-2 shadow-[0_10px_28px_-14px_rgba(11,27,43,0.5)]">
      <p className="num text-[12px] text-mist">{shortDate(label)}</p>
      <p className="num text-[15px] font-semibold">{currency(amount)}</p>
      <p className={`num text-[12px] ${delta > 0 ? 'text-flag' : 'text-sea'}`}>
        {delta > 0 ? '+' : ''}{currency(delta)} vs the average day
      </p>
    </div>
  );
}
