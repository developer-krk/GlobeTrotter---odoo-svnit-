/** The wordmark: a route line that ends in a stop node, then the name. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="13" cy="13" r="12" fill="var(--color-ink)" />
        <path d="M5 17 Q 10 6 13 11 T 21 8" fill="none" stroke="var(--color-route)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="5" cy="17" r="2" fill="#fff" />
        <circle cx="21" cy="8" r="2.6" fill="var(--color-route)" stroke="#fff" strokeWidth="1" />
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-extrabold tracking-[-0.03em]">
          Globe<span className="text-route">Trotter</span>
        </span>
      )}
    </span>
  );
}
