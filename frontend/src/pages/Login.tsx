import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, errorText } from '../lib/api';
import { Brand } from '../components/Brand';
import { Button, Fieldset, Input, Notice } from '../components/ui';
import { AuthAside } from '../components/AuthAside';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setForgot('');
    if (!email) {
      setError('Enter your email address first, then choose "Forgot password".');
      return;
    }
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setForgot(data.message);
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }

  function useDemo() {
    setEmail('sam@globetrotter.app');
    setPassword('globetrotter');
    setError('');
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,44%)]">
      <AuthAside />

      <div className="flex items-center justify-center bg-surface px-5 py-12">
        <div className="rise w-full max-w-[380px]">
          <div className="mb-8 lg:hidden"><Brand /></div>

          <p className="eyebrow mb-2">Welcome back</p>
          <h1 className="mb-1 text-[30px]">Sign in</h1>
          <p className="mb-7 text-[14.5px] text-slate">Your trips, stops and budgets are where you left them.</p>

          <form onSubmit={submit} className="space-y-3.5">
            <Fieldset label="Email address">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Fieldset>

            <Fieldset label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Fieldset>

            {error && <Notice>{error}</Notice>}
            {forgot && <Notice tone="sea">{forgot}</Notice>}

            <Button type="submit" variant="primary" busy={busy} className="w-full">
              Sign in <ArrowRight size={15} />
            </Button>

            <div className="flex items-center justify-between pt-1 text-[13px]">
              <button type="button" onClick={sendReset} className="text-slate underline-offset-2 hover:text-route hover:underline">
                Forgot password
              </button>
              <button type="button" onClick={useDemo} className="text-slate underline-offset-2 hover:text-route hover:underline">
                Use the demo account
              </button>
            </div>
          </form>

          <p className="mt-8 border-t pt-5 text-[13.5px] text-slate">
            New here?{' '}
            <Link to="/register" className="font-medium text-route underline-offset-2 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
