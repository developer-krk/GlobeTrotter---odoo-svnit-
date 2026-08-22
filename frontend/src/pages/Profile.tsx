import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookmarkX, Check, Pencil, Trash2 } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { currency, dateRange } from '../lib/format';
import type { City, Trip, User } from '../lib/types';
import { Avatar, Plate } from '../components/Plate';
import { StatusPill } from '../components/TripCard';
import { Button, Empty, Fieldset, Input, Modal, Notice, Select, Spinner, Textarea } from '../components/ui';

interface ProfileData {
  user: User;
  planned: Trip[];
  previous: Trip[];
  savedCities: City[];
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी — Hindi' },
  { value: 'gu', label: 'ગુજરાતી — Gujarati' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ja', label: '日本語' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD'];

export default function Profile() {
  const { setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => api.get('/users/me').then(({ data }) => setData(data)).catch((err) => setError(errorText(err)));
  useEffect(() => { load(); }, []);

  async function unsave(city: City) {
    setData((current) => current && { ...current, savedCities: current.savedCities.filter((c) => c.id !== city.id) });
    await api.delete(`/cities/${city.id}/save`).catch((err) => setError(errorText(err)));
  }

  async function deleteAccount() {
    try {
      await api.delete('/users/me');
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <Spinner label="Loading your profile" />;

  const { user } = data;
  const name = `${user.first_name} ${user.last_name}`.trim();

  return (
    <div>
      {/* ------------------------------------------------------- details */}
      <section className="card mb-6 flex flex-col gap-5 p-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Avatar name={name} src={user.photo_url} size={104} />
          <span className="eyebrow">{user.role === 'admin' ? 'Administrator' : 'Traveller'}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[27px] leading-tight">{name}</h1>
              <p className="num text-[13px] text-slate">{user.email}</p>
              <p className="num text-[13px] text-mist">
                {[user.city, user.country].filter(Boolean).join(', ') || 'No home city set'}
                {user.phone && ` · ${user.phone}`}
              </p>
            </div>
            <Button onClick={() => setEditing(true)}><Pencil size={14} /> Edit details</Button>
          </div>

          {user.bio && <p className="mt-3 max-w-[70ch] text-[14px] text-slate">{user.bio}</p>}

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
            <Fact label="Trips" value={String(data.planned.length + data.previous.length)} />
            <Fact label="Planned" value={String(data.planned.length)} />
            <Fact label="Saved places" value={String(data.savedCities.length)} />
            <Fact label="Language" value={LANGUAGES.find((l) => l.value === user.language)?.label.split(' — ')[0] ?? user.language} />
          </dl>
        </div>
      </section>

      {saved && <div className="mb-4"><Notice tone="sea">{saved}</Notice></div>}
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}

      {/* -------------------------------------------------- planned trips */}
      <TripGrid title="Planned trips" hint="Ongoing and upcoming" trips={data.planned} emptyBody="Nothing on the calendar. Plan a trip and it shows up here." />
      <TripGrid title="Previous trips" hint="Everything that has already happened" trips={data.previous} emptyBody="Once a trip's end date passes it moves here." />

      {/* ------------------------------------------------- saved cities */}
      <section className="mb-6">
        <div className="mb-2.5 flex items-baseline gap-3">
          <h2 className="text-[21px]">Saved destinations</h2>
          <span className="num text-[12.5px] text-mist">{data.savedCities.length}</span>
          <span className="h-px flex-1 bg-rule" />
        </div>

        {data.savedCities.length === 0 ? (
          <Empty
            title="No saved destinations"
            body="Bookmark a city while you are exploring and it waits here until you are ready to plan around it."
            action={<Link to="/explore"><Button variant="primary">Explore cities</Button></Link>}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.savedCities.map((city) => (
              <li key={city.id} className="card overflow-hidden">
                <Plate name={city.name} ratio="aspect-[16/9]" label={city.region} className="rounded-b-none" />
                <div className="flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{city.name}</span>
                    <span className="num block truncate text-[11.5px] text-mist">
                      {city.country} · {currency(city.cost_index)}/day
                    </span>
                  </span>
                  <button
                    onClick={() => unsave(city)}
                    className="shrink-0 rounded p-1.5 text-mist hover:bg-flag-soft hover:text-flag"
                    aria-label={`Remove ${city.name}`}
                  >
                    <BookmarkX size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ danger */}
      <section className="card border-flag/25 p-5">
        <h2 className="text-[18px]">Delete this account</h2>
        <p className="mt-1 max-w-[62ch] text-[13.5px] text-slate">
          Deleting your account removes your trips, stops, activities, costs and community posts. Nothing is kept and
          nothing can be restored.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} /> Delete my account
        </Button>
      </section>

      <EditModal
        open={editing}
        user={user}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setUser(updated);
          setData((current) => current && { ...current, user: updated });
          setSaved('Your details are up to date.');
          setTimeout(() => setSaved(''), 3000);
        }}
      />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this account">
        <p className="text-[14px] text-slate">
          This removes everything tied to <strong className="text-ink">{user.email}</strong> straight away.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Keep my account</Button>
          <Button variant="danger" onClick={deleteAccount}><Trash2 size={14} /> Delete it</Button>
        </div>
      </Modal>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="num text-[19px] font-semibold">{value}</dd>
    </div>
  );
}

function TripGrid({ title, hint, trips, emptyBody }: { title: string; hint: string; trips: Trip[]; emptyBody: string }) {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-baseline gap-3">
        <h2 className="text-[21px]">{title}</h2>
        <span className="num text-[12.5px] text-mist">{trips.length}</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      {trips.length === 0 ? (
        <p className="card px-4 py-6 text-center text-[13.5px] text-mist">{emptyBody}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.id} className="card overflow-hidden">
              <Plate name={trip.route?.[0]?.city ?? trip.name} ratio="aspect-[16/9]" label={trip.route?.[0]?.city} className="rounded-b-none" />
              <div className="p-3.5">
                <StatusPill status={trip.status} />
                <h3 className="mt-1.5 truncate text-[16px]">{trip.name}</h3>
                <p className="num text-[12px] text-mist">{dateRange(trip.start_date, trip.end_date)}</p>
                <p className="num mt-1 text-[12.5px] text-slate">
                  {trip.route?.length ?? 0} stops · {currency(trip.budget.total)}
                </p>
                <Link to={`/trips/${trip.id}`} className="mt-3 block">
                  <Button size="sm" className="w-full">View</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditModal({ open, user, onClose, onSaved }: {
  open: boolean; user: User; onClose: () => void; onSaved: (user: User) => void;
}) {
  const [form, setForm] = useState({
    firstName: user.first_name, lastName: user.last_name, email: user.email,
    phone: user.phone ?? '', city: user.city ?? '', country: user.country ?? '',
    bio: user.bio ?? '', photoUrl: user.photo_url ?? '',
    language: user.language, homeCurrency: user.home_currency,
  });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: user.first_name, lastName: user.last_name, email: user.email,
      phone: user.phone ?? '', city: user.city ?? '', country: user.country ?? '',
      bio: user.bio ?? '', photoUrl: user.photo_url ?? '',
      language: user.language, homeCurrency: user.home_currency,
    });
    setPassword('');
    setError('');
  }, [open, user]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<any>) => setForm({ ...form, [key]: e.target.value });

  async function save() {
    setBusy(true); setError('');
    try {
      const { data } = await api.patch('/users/me', form);
      if (password) await api.post('/users/me/password', { password });
      onSaved(data.user);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit your details" wide>
      <div className="space-y-3.5">
        <div className="flex items-center gap-4 rounded-[12px] border bg-canvas/60 p-3">
          <Avatar name={`${form.firstName} ${form.lastName}`} src={form.photoUrl || null} size={56} />
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[13px] font-medium">Photo link</span>
            <Input value={form.photoUrl} onChange={set('photoUrl')} placeholder="Paste an image address" />
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Fieldset label="First name"><Input value={form.firstName} onChange={set('firstName')} /></Fieldset>
          <Fieldset label="Last name"><Input value={form.lastName} onChange={set('lastName')} /></Fieldset>
          <Fieldset label="Email address"><Input type="email" value={form.email} onChange={set('email')} /></Fieldset>
          <Fieldset label="Phone number"><Input value={form.phone} onChange={set('phone')} /></Fieldset>
          <Fieldset label="City"><Input value={form.city} onChange={set('city')} /></Fieldset>
          <Fieldset label="Country"><Input value={form.country} onChange={set('country')} /></Fieldset>
          <Fieldset label="Language">
            <Select value={form.language} onChange={set('language')}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Fieldset>
          <Fieldset label="Home currency" hint="Display only">
            <Select value={form.homeCurrency} onChange={set('homeCurrency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Fieldset>
        </div>

        <Fieldset label="About you" hint="optional">
          <Textarea rows={3} value={form.bio} onChange={set('bio')} />
        </Fieldset>

        <Fieldset label="New password" hint="Leave blank to keep the current one">
          <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </Fieldset>

        {error && <Notice>{error}</Notice>}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={save}><Check size={14} /> Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
