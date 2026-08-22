import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';

/* -------------------------------------------------------------- buttons */

type Variant = 'primary' | 'quiet' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-route text-white border-route hover:bg-[#1c39cb] shadow-[0_1px_2px_rgba(11,27,43,0.18)]',
  quiet: 'bg-surface text-ink border-rule hover:bg-canvas',
  ghost: 'bg-transparent text-slate border-transparent hover:bg-sunk hover:text-ink',
  danger: 'bg-surface text-flag border-flag/35 hover:bg-flag-soft',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  busy?: boolean;
}

export function Button({ variant = 'quiet', size = 'md', busy, className = '', children, ...rest }: ButtonProps) {
  const pad = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm';
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] border font-medium
        transition-colors disabled:opacity-55 disabled:cursor-not-allowed ${pad} ${variants[variant]} ${className}`}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- inputs */

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-ink">{children}</span>
      {hint && <span className="eyebrow">{hint}</span>}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} {...rest} className={`field ${className}`} />
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => <textarea ref={ref} {...rest} className={`field resize-y ${className}`} />
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...rest }, ref) => (
    <select ref={ref} {...rest} className={`field appearance-none bg-no-repeat pr-8 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2356697A' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 11px center',
      }}
    />
  )
);
Select.displayName = 'Select';

export function Fieldset({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      {children}
    </label>
  );
}

/* --------------------------------------------------------------- pieces */

export function Badge({ tone, children }: { tone?: { fg: string; bg: string }; children: ReactNode }) {
  return (
    <span
      className="num inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={tone ? { color: tone.fg, background: tone.bg } : { color: 'var(--color-slate)', background: 'var(--color-sunk)' }}
    >
      {children}
    </span>
  );
}

export function Notice({ tone = 'flag', children }: { tone?: 'flag' | 'sand' | 'sea'; children: ReactNode }) {
  const tones = {
    flag: 'bg-flag-soft text-flag border-flag/25',
    sand: 'bg-sand-soft text-sand border-sand/25',
    sea: 'bg-sea-soft text-sea border-sea/25',
  };
  return <div className={`rounded-[10px] border px-3 py-2 text-[13px] ${tones[tone]}`}>{children}</div>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 justify-center text-mist">
      <Loader2 size={16} className="animate-spin" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
        <circle cx="26" cy="26" r="25" stroke="var(--color-rule)" strokeDasharray="3 5" />
        <circle cx="15" cy="32" r="4" fill="var(--color-route)" />
        <circle cx="37" cy="20" r="4" fill="var(--color-rule)" />
        <path d="M15 32 L37 20" stroke="var(--color-route)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-sm text-sm text-slate">{body}</p>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`rise card max-h-[90vh] w-full overflow-y-auto rounded-b-none sm:rounded-b-[14px] ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-surface px-5 py-3.5">
          <h2 className="text-[17px]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
