import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { AuthLayout } from '../components/AuthLayout';
import { Field } from '../components/Field';
import { Button, Input } from '../components/ui';

const FEATURES = [
  'Track movies, TV, anime, docs & more',
  'Independent library for every user',
  'Ratings, reviews & watch history — self-hosted',
];

/** Strength cues are advisory; the server enforces the real minimum. */
function strength(pw: string): { pct: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Too short', color: 'rgb(var(--muted-2))' },
    { label: 'Weak', color: 'rgb(var(--rose))' },
    { label: 'Fair', color: '#e0913c' },
    { label: 'Good', color: 'rgb(var(--gold))' },
    { label: 'Strong', color: 'rgb(var(--cyan))' },
    { label: 'Strong', color: 'rgb(var(--cyan))' },
  ];
  return { pct: (score / 5) * 100, label: levels[score]!.label, color: levels[score]!.color };
}

export function SetupPage(): JSX.Element {
  const { setup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pw = useMemo(() => strength(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    username.trim().length >= 3 && password.length >= 8 && confirm === password && !busy;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await setup({ username: username.trim(), password, email: email || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="First-run setup"
      heading="Create your admin"
      subheading="This first account owns the server — it can manage users, providers, and settings."
      features={FEATURES}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Username">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. logan"
            autoFocus
          />
        </Field>
        <Field label="Email" hint="optional">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          {password.length > 0 && (
            <span className="mt-2 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(8, pw.pct)}%`, background: pw.color }}
                />
              </span>
              <span className="w-14 text-right text-[11px] text-muted-2">{pw.label}</span>
            </span>
          )}
        </Field>
        <Field label="Confirm password" error={mismatch ? 'Passwords do not match' : null}>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
          />
        </Field>

        {error && (
          <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!canSubmit}>
          {busy ? 'Creating…' : 'Create admin account'}
        </Button>
        <p className="text-center text-xs text-muted-2">
          You can add more users later from the admin panel.
        </p>
      </form>
    </AuthLayout>
  );
}
