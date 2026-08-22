import { Brand } from './Brand';

/**
 * The left half of the sign-in screens. It draws the same route spine the app
 * uses for real itineraries, so the first thing you see is the thing you build.
 */
const SAMPLE = [
  { city: 'Lisbon', country: 'Portugal', nights: 4, spend: '$620' },
  { city: 'Porto', country: 'Portugal', nights: 3, spend: '$410' },
  { city: 'Barcelona', country: 'Spain', nights: 4, spend: '$780' },
];

export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" aria-hidden>
        <defs>
          <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="#7FA0FF" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="relative">
        <div className="[&_span]:text-white">
          <Brand />
        </div>
      </div>

      <div className="relative max-w-[440px]">
        <h2 className="text-[40px] leading-[1.05] text-white">
          Every trip is a line<br />
          <span className="text-[#8FA6FF]">between places.</span>
        </h2>
        <p className="mt-4 max-w-[380px] text-[15px] leading-relaxed text-[#A9BACB]">
          Add your stops, give each one dates and activities, and GlobeTrotter keeps the running total so you know
          what the plan costs before you book anything.
        </p>

        <div className="mt-10 space-y-0">
          {SAMPLE.map((stop, i) => (
            <div key={stop.city} className="relative flex items-center gap-4 py-3">
              <div className="relative flex w-8 shrink-0 justify-center">
                {i < SAMPLE.length - 1 && (
                  <span className="absolute left-1/2 top-8 h-[calc(100%-8px)] w-px -translate-x-1/2 bg-gradient-to-b from-[#4A6BFF] to-[#4A6BFF]/20" />
                )}
                <span className="num relative z-10 grid h-8 w-8 place-items-center rounded-full bg-[#2647E8] text-[12px] font-semibold text-white">
                  {i + 1}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-white">{stop.city}</p>
                <p className="text-[12.5px] text-[#8397AA]">{stop.country} · {stop.nights} nights</p>
              </div>
              <span className="num text-[13px] text-[#A9BACB]">{stop.spend}</span>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-white/12 pt-3">
            <span className="eyebrow text-[#8397AA]">Estimated total</span>
            <span className="num text-[15px] font-semibold text-white">$1,810</span>
          </div>
        </div>
      </div>

      <p className="relative text-[12.5px] text-[#6C7F92]">
        11 days · 3 cities · 2 countries · 1 rail pass
      </p>
    </aside>
  );
}
