import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Check, Copy, Share2, Trash2, Users, Wallet } from 'lucide-react';
import type { Trip } from '../lib/types';
import { api, errorText } from '../lib/api';
import { currency, dateRange } from '../lib/format';
import { StatusPill } from './TripCard';
import { Button, Modal, Notice } from './ui';

const TABS = [
  { slug: '', label: 'Itinerary' },
  { slug: 'build', label: 'Build' },
  { slug: 'budget', label: 'Budget' },
];

export function TripHeader({ trip, onChange }: { trip: Trip; onChange: (trip: Trip) => void }) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const shareUrl = trip.share_slug ? `${window.location.origin}/s/${trip.share_slug}` : '';

  async function toggleShare(isPublic: boolean) {
    try {
      const { data } = await api.post(`/trips/${trip.id}/share`, { isPublic });
      onChange({ ...trip, is_public: isPublic ? 1 : 0, share_slug: data.slug });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copying failed. Select the address and copy it by hand.');
    }
  }

  async function remove() {
    try {
      await api.delete(`/trips/${trip.id}`);
      navigate('/trips', { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <header className="mb-5">
      <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] text-mist">
        <Link to="/trips" className="hover:text-route hover:underline">My trips</Link>
        <span>/</span>
        <span className="truncate text-slate">{trip.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <StatusPill status={trip.status} />
            {trip.is_public === 1 && (
              <span className="eyebrow inline-flex items-center gap-1 rounded-full bg-sea-soft px-2 py-1 text-sea">
                <Share2 size={10} /> Shared
              </span>
            )}
          </div>
          <h1 className="text-[30px] leading-tight">{trip.name}</h1>
          {trip.description && <p className="mt-1 max-w-[70ch] text-[14px] text-slate">{trip.description}</p>}

          <dl className="num mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate">
            <span>{dateRange(trip.start_date, trip.end_date)}</span>
            <span className="text-mist">·</span>
            <span>{trip.days} days</span>
            <span className="text-mist">·</span>
            <span>{trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'}</span>
            <span className="text-mist">·</span>
            <span className="inline-flex items-center gap-1"><Users size={12} className="text-mist" />{trip.travellers}</span>
            <span className="text-mist">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Wallet size={12} className="text-mist" />{currency(trip.budget.total)}
            </span>
          </dl>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button onClick={() => setShareOpen(true)}><Share2 size={14} /> Share</Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)} aria-label="Delete trip"><Trash2 size={14} /></Button>
        </div>
      </div>

      {error && <div className="mt-3"><Notice>{error}</Notice></div>}

      <div className="mt-5 flex gap-1 border-b">
        {TABS.map((tab) => (
          <NavLink
            key={tab.slug}
            to={`/trips/${trip.id}${tab.slug ? `/${tab.slug}` : ''}`}
            end={tab.slug === ''}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-3 pb-2.5 pt-1 text-[14px] font-medium transition-colors ${
                isActive ? 'border-route text-route' : 'border-transparent text-slate hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share this itinerary">
        <div className="space-y-4">
          <p className="text-[14px] text-slate">
            A shared itinerary is read-only. Anyone with the link can look at the plan and copy it into their own
            account, but they cannot change yours.
          </p>

          <label className="flex items-center gap-3 rounded-[10px] border p-3">
            <input
              type="checkbox"
              checked={trip.is_public === 1}
              onChange={(e) => toggleShare(e.target.checked)}
              className="h-4 w-4 accent-[#2647E8]"
            />
            <span className="text-[14px] font-medium">Anyone with the link can view this trip</span>
          </label>

          {trip.is_public === 1 && shareUrl && (
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="field num text-[12.5px]" onFocus={(e) => e.target.select()} />
              <Button onClick={copyLink} variant={copied ? 'quiet' : 'primary'}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </Button>
            </div>
          )}

          {trip.is_public === 1 && shareUrl && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <span className="eyebrow self-center">Post it</span>
              {[
                { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${trip.name} — ${shareUrl}`)}` },
                { label: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(trip.name)}&url=${encodeURIComponent(shareUrl)}` },
                { label: 'Email', href: `mailto:?subject=${encodeURIComponent(trip.name)}&body=${encodeURIComponent(shareUrl)}` },
              ].map((target) => (
                <a key={target.label} href={target.href} target="_blank" rel="noreferrer">
                  <Button size="sm">{target.label}</Button>
                </a>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this trip">
        <p className="text-[14px] text-slate">
          Deleting <strong className="text-ink">{trip.name}</strong> removes its stops, activities and costs. This
          cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Keep the trip</Button>
          <Button variant="danger" onClick={remove}><Trash2 size={14} /> Delete it</Button>
        </div>
      </Modal>
    </header>
  );
}
