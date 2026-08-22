import { useMemo } from 'react';
import { seedFrom } from '../lib/format';

/**
 * Generated artwork for a place, drawn from its name.
 *
 * The catalogue ships without photographs, and a grey box is worse than
 * nothing. Each plate is a contour reading of an invented coastline: the same
 * name always draws the same map, so a city looks the same on every screen.
 */

const SCHEMES = [
  { ink: '#0B1B2B', line: '#2647E8', wash: '#DDE4FB' },
  { ink: '#0D2B2A', line: '#0E8F87', wash: '#D5EFEC' },
  { ink: '#2B1D08', line: '#C98A05', wash: '#FAEED2' },
  { ink: '#2B1210', line: '#C0431F', wash: '#FADFD9' },
  { ink: '#1B0F2B', line: '#7B3FBF', wash: '#EDE3FA' },
  { ink: '#0B1B2B', line: '#1F3A5F', wash: '#DCE4EE' },
];

/** A small deterministic generator, so plates never change between renders. */
function rng(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

function contour(next: () => number, y: number, amp: number) {
  const points: string[] = [`M -10 ${y.toFixed(1)}`];
  for (let x = 0; x <= 220; x += 20) {
    const drift = (next() - 0.5) * amp;
    points.push(`Q ${x + 10} ${(y + drift).toFixed(1)} ${x + 20} ${(y + drift * 0.35).toFixed(1)}`);
  }
  return points.join(' ');
}

export function Plate({ name, className = '', ratio = 'aspect-[16/10]', label }: {
  name: string;
  className?: string;
  ratio?: string;
  label?: string;
}) {
  const art = useMemo(() => {
    const seed = seedFrom(name);
    const next = rng(seed);
    const scheme = SCHEMES[seed % SCHEMES.length];
    const lines = Array.from({ length: 7 }, (_, i) => contour(next, 22 + i * 16, 16 + i * 2));
    const marker = { x: 40 + next() * 120, y: 30 + next() * 60 };
    return { scheme, lines, marker };
  }, [name]);

  const { scheme, lines, marker } = art;

  return (
    <div className={`relative overflow-hidden rounded-[10px] ${ratio} ${className}`} style={{ background: scheme.wash }}>
      <svg viewBox="0 0 200 125" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        {lines.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={scheme.line}
            strokeWidth={i === 3 ? 1.4 : 0.7}
            opacity={i === 3 ? 0.75 : 0.3 + i * 0.03}
          />
        ))}
        <circle cx={marker.x} cy={marker.y} r="3.4" fill={scheme.line} />
        <circle cx={marker.x} cy={marker.y} r="8" fill="none" stroke={scheme.line} strokeWidth="0.8" opacity="0.5" />
      </svg>
      {label && (
        <span
          className="num absolute bottom-1.5 left-2 text-[10px] font-medium tracking-[0.1em] uppercase"
          style={{ color: scheme.ink, opacity: 0.7 }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** A round version for people. */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const seed = seedFrom(name || '?');
  const scheme = SCHEMES[seed % SCHEMES.length];
  const letters = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  if (src) {
    return <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="num inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, background: scheme.wash, color: scheme.line, fontSize: size * 0.36 }}
    >
      {letters}
    </span>
  );
}
