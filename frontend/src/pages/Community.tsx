import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Plus, Route as RouteIcon } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { longDate } from '../lib/format';
import type { City, Post, Trip } from '../lib/types';
import { Avatar, Plate } from '../components/Plate';
import { ControlStrip } from '../components/ControlStrip';
import { Button, Empty, Fieldset, Input, Modal, Notice, Select, Spinner, Textarea } from '../components/ui';

interface SharedTrip {
  id: number; name: string; description: string | null; share_slug: string;
  owner_name: string; stop_count: number; route: string | null;
  start_date: string; end_date: string;
}

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [shared, setShared] = useState<SharedTrip[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [cityFilter, setCityFilter] = useState('');
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);

  // The city menu is built from the posts already loaded, so it filters here
  // rather than round-tripping a name the API would read as an id.
  const load = () => {
    api.get('/community', { params: { q: query || undefined, sort } })
      .then(({ data }) => setPosts(data.posts))
      .catch((err) => { setError(errorText(err)); setPosts([]); });
  };

  useEffect(load, [query, sort]);

  useEffect(() => {
    api.get('/public/trips', { params: { limit: 8 } }).then(({ data }) => setShared(data.trips)).catch(() => setShared([]));
  }, []);

  const cityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const post of posts ?? []) {
      if (post.city_name) seen.set(post.city_name, post.city_name);
    }
    return [...seen.keys()].sort();
  }, [posts]);

  async function like(post: Post) {
    setPosts((current) =>
      (current ?? []).map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: p.liked_by_me ? 0 : 1, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
          : p
      )
    );
    try {
      await api.post(`/community/${post.id}/like`);
    } catch (err) {
      setError(errorText(err));
      load();
    }
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">What other travellers found out</p>
          <h1 className="text-[30px]">Community</h1>
          <p className="mt-1 max-w-[62ch] text-[14.5px] text-slate">
            One thing you wish you had known before the trip, written down for the next person.
          </p>
        </div>
        <Button variant="primary" onClick={() => setWriting(true)}><Plus size={15} /> Share something</Button>
      </header>

      {shared.length > 0 && (
        <section className="mb-6">
          <div className="mb-2.5 flex items-baseline gap-3">
            <h2 className="text-[18px]">Itineraries you can copy</h2>
            <span className="h-px flex-1 bg-rule" />
          </div>
          <div className="rail flex gap-3 overflow-x-auto pb-2">
            {shared.map((trip) => (
              <Link
                key={trip.id}
                to={`/s/${trip.share_slug}`}
                className="card w-[230px] shrink-0 overflow-hidden transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(11,27,43,0.4)]"
              >
                <Plate name={trip.route?.split(' → ')[0] ?? trip.name} ratio="aspect-[16/9]" className="rounded-b-none" />
                <div className="p-3">
                  <h3 className="truncate text-[15px]">{trip.name}</h3>
                  <p className="truncate text-[12px] text-slate">{trip.route ?? 'No stops yet'}</p>
                  <p className="num mt-1.5 flex items-center gap-1 text-[11.5px] text-mist">
                    <RouteIcon size={11} /> {trip.stop_count} stops · {trip.owner_name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ControlStrip
        query={query}
        onQuery={setQuery}
        placeholder="Search what people wrote…"
        groupBy={cityFilter}
        onGroupBy={setCityFilter}
        groupOptions={[{ value: '', label: 'Everywhere' }, ...cityOptions.map((c) => ({ value: c, label: c }))]}
        sortBy={sort}
        onSortBy={setSort}
        sortOptions={[
          { value: 'newest', label: 'Newest' },
          { value: 'liked', label: 'Most liked' },
          { value: 'oldest', label: 'Oldest' },
        ]}
      />

      {error && <div className="mb-4"><Notice>{error}</Notice></div>}

      {posts === null ? (
        <Spinner label="Loading the community" />
      ) : posts.length === 0 ? (
        <Empty
          title="Nothing here yet"
          body="Be the first. One paragraph about a place you have been is more useful than a whole guidebook."
          action={<Button variant="primary" onClick={() => setWriting(true)}><Plus size={15} /> Share something</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {posts
            .filter((p) => !cityFilter || p.city_name === cityFilter)
            .map((post) => (
              <li key={post.id} className="card flex gap-4 p-4">
                <Avatar name={post.author_name} src={post.author_photo} size={40} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-semibold">{post.author_name}</span>
                    <span className="num text-[12px] text-mist">{longDate(post.created_at.slice(0, 10))}</span>
                    {post.city_name && (
                      <span className="num inline-flex items-center gap-1 text-[12px] text-route">
                        <MapPin size={11} /> {post.city_name}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1 text-[17px]">{post.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-slate">{post.body}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-2.5">
                    <button
                      onClick={() => like(post)}
                      className={`inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors ${
                        post.liked_by_me ? 'text-flag' : 'text-slate hover:text-flag'
                      }`}
                      aria-pressed={Boolean(post.liked_by_me)}
                    >
                      <Heart size={14} fill={post.liked_by_me ? 'currentColor' : 'none'} />
                      <span className="num">{post.like_count}</span>
                    </button>

                    {post.share_slug && (
                      <Link to={`/s/${post.share_slug}`} className="text-[13px] font-medium text-route hover:underline">
                        See the itinerary
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      )}

      <WriteModal open={writing} onClose={() => { setWriting(false); load(); }} />
    </div>
  );
}

function WriteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({ title: '', body: '', tripId: '', cityId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({ title: '', body: '', tripId: '', cityId: '' });
    setError('');
    api.get('/trips').then(({ data }) => setTrips(data.trips)).catch(() => setTrips([]));
    api.get('/cities', { params: { limit: 60, sort: 'name' } }).then(({ data }) => setCities(data.cities)).catch(() => setCities([]));
  }, [open]);

  async function save() {
    setBusy(true); setError('');
    try {
      await api.post('/community', {
        title: form.title,
        body: form.body,
        tripId: form.tripId || null,
        cityId: form.cityId || null,
      });
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share something you learned">
      <div className="space-y-3">
        <Fieldset label="Headline" hint="Say the useful part first">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Book the lagoon before you land"
          />
        </Fieldset>

        <Fieldset label="What happened">
          <Textarea
            rows={5}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="What you tried, what it cost, and what you would do differently."
          />
        </Fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Fieldset label="About which city" hint="optional">
            <Select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              <option value="">Not about one city</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
            </Select>
          </Fieldset>

          <Fieldset label="Attach a trip" hint="optional">
            <Select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}>
              <option value="">No itinerary</option>
              {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </Select>
          </Fieldset>
        </div>

        {form.tripId && trips.find((t) => String(t.id) === form.tripId)?.is_public !== 1 && (
          <Notice tone="sand">
            That trip is private, so the link will not open for anyone else. Share it from the trip page first.
          </Notice>
        )}

        {error && <Notice>{error}</Notice>}

        <Button variant="primary" busy={busy} onClick={save} className="w-full">
          <Plus size={15} /> Post it
        </Button>
      </div>
    </Modal>
  );
}
