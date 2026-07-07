import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { AuthShell } from '../components/AuthShell';
import { Button, Input } from '../components/ui';
import { Field } from './LoginPage';

export function SetupPage(): JSX.Element {
  const { setup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setup({ username, password, email: email || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome to Cinelog"
      subtitle="Create the administrator account to get started"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="Email (optional)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create admin account'}
        </Button>
      </form>
    </AuthShell>
  );
}
