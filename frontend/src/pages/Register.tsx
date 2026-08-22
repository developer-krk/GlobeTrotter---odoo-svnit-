import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errorText } from '../lib/api';
import { Brand } from '../components/Brand';
import { Avatar } from '../components/Plate';
import { AuthAside } from '../components/AuthAside';
import { Button, Fieldset, Input, Notice, Textarea } from '../components/ui';

const BLANK = {
  firstName: '', lastName: '', email: '', password: '',
  phone: '', city: '', country: '', bio: '', photoUrl: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof BLANK) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const displayName = `${form.firstName} ${form.lastName}`.trim();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(520px,52%)]">
      <AuthAside />

      <div className="flex items-center justify-center bg-surface px-5 py-12">
        <div className="rise w-full max-w-[520px]">
          <div className="mb-8 lg:hidden"><Brand /></div>

          <p className="eyebrow mb-2">Create an account</p>
          <h1 className="mb-1 text-[30px]">Start planning</h1>
          <p className="mb-7 text-[14.5px] text-slate">
            Only the first four fields are required. The rest helps us suggest places near you.
          </p>

          <form onSubmit={submit} className="space-y-3.5">
            <div className="flex items-center gap-4 rounded-[12px] border bg-canvas/60 p-3">
              <Avatar name={displayName || '?'} src={form.photoUrl || null} size={56} />
              <label className="min-w-0 flex-1">
                <span className="mb-1 flex items-center gap-1.5 text-[13px] font-medium">
                  <Camera size={13} className="text-mist" /> Photo link
                </span>
                <Input
                  value={form.photoUrl}
                  onChange={set('photoUrl')}
                  placeholder="Paste an image address, or leave it blank"
                />
              </label>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Fieldset label="First name">
                <Input required value={form.firstName} onChange={set('firstName')} placeholder="Sam" autoComplete="given-name" />
              </Fieldset>
              <Fieldset label="Last name">
                <Input value={form.lastName} onChange={set('lastName')} placeholder="Rivera" autoComplete="family-name" />
              </Fieldset>
              <Fieldset label="Email address">
                <Input required type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
              </Fieldset>
              <Fieldset label="Password" hint="8+ characters">
                <Input required type="password" minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
              </Fieldset>
              <Fieldset label="Phone number" hint="optional">
                <Input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" autoComplete="tel" />
              </Fieldset>
              <Fieldset label="City" hint="optional">
                <Input value={form.city} onChange={set('city')} placeholder="Surat" autoComplete="address-level2" />
              </Fieldset>
            </div>

            <Fieldset label="Country" hint="optional">
              <Input value={form.country} onChange={set('country')} placeholder="India" autoComplete="country-name" />
            </Fieldset>

            <Fieldset label="Anything else" hint="optional">
              <Textarea
                rows={3}
                value={form.bio}
                onChange={set('bio')}
                placeholder="How you like to travel, what you are saving for, where you have been."
              />
            </Fieldset>

            {error && <Notice>{error}</Notice>}

            <Button type="submit" variant="primary" busy={busy} className="w-full">
              Create account <ArrowRight size={15} />
            </Button>
          </form>

          <p className="mt-8 border-t pt-5 text-[13.5px] text-slate">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-route underline-offset-2 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
