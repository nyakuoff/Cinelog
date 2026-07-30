import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import type { AdminUser, UserRole } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Button, Card, Input, Spinner } from '../components/ui';
import { Field } from '../components/Field';

export function AdminPage(): JSX.Element {
  const { user } = useAuth();
  // Route guard: only admins reach the panel; everyone else bounces home.
  if (user && user.role !== 'ADMIN') return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.2em] text-gold">Admin</p>
      <h1 className="font-cond text-3xl font-extrabold uppercase tracking-tight">Instance</h1>
      <p className="mt-1 text-sm text-muted">
        Manage accounts and point Cinelog at the other services you host.
      </p>

      <IntegrationsCard />
      <CreateUserCard />
      <UserList currentUserId={user?.id ?? ''} />
    </div>
  );
}

// -------------------------------------------------------------------------

/**
 * Points Cinelog at the other services the instance owner runs.
 *
 * API keys are write-only: the server never returns them, so these fields show
 * whether one is stored rather than its value. Leaving a key field blank keeps
 * the stored key; typing a space and saving clears it. Every call that uses a
 * key is made by the API, so no key reaches a browser.
 */
function IntegrationsCard(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations(),
  });

  const [form, setForm] = useState<{
    jellyfinUrl?: string;
    jellyfinApiKey?: string;
    seerrUrl?: string;
    seerrApiKey?: string;
    watchRegion?: string;
  }>({});
  const [saved, setSaved] = useState(false);

  const field = (k: 'jellyfinUrl' | 'seerrUrl' | 'watchRegion'): string =>
    form[k] ?? data?.[k] ?? '';

  const mut = useMutation({
    mutationFn: () =>
      api.updateIntegrations({
        jellyfinUrl: field('jellyfinUrl'),
        seerrUrl: field('seerrUrl'),
        watchRegion: field('watchRegion'),
        // Only send a key when one was typed, so saving a URL change doesn't
        // wipe a key this form was never shown.
        ...(form.jellyfinApiKey !== undefined ? { jellyfinApiKey: form.jellyfinApiKey } : {}),
        ...(form.seerrApiKey !== undefined ? { seerrApiKey: form.seerrApiKey } : {}),
      }),
    onSuccess: () => {
      setSaved(true);
      setForm({});
      void queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-1 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-content">
        Integrations
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-muted">
        Streaming availability comes from TMDB and needs nothing configured here. Add a Jellyfin
        server to link straight to your own copy, and a Jellyseerr instance to request what you
        don&rsquo;t have. API keys are stored server-side and never sent to the browser.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <div className="space-y-3">
            <p className="font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
              Jellyfin
            </p>
            <Field label="Server URL">
              <Input
                value={field('jellyfinUrl')}
                onChange={(e) => setForm((f) => ({ ...f, jellyfinUrl: e.target.value }))}
                placeholder="https://jellyfin.example.com"
                inputMode="url"
              />
            </Field>
            <Field label={data?.hasJellyfinApiKey ? 'API key (stored)' : 'API key'}>
              <Input
                type="password"
                value={form.jellyfinApiKey ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, jellyfinApiKey: e.target.value }))}
                placeholder={
                  data?.hasJellyfinApiKey ? 'Leave blank to keep the stored key' : 'Optional'
                }
                autoComplete="off"
              />
            </Field>
            <p className="text-xs leading-relaxed text-muted-2">
              With a key, Cinelog checks whether the title is actually on your server (matching
              its TMDB id) and links straight to it. Without one, it can only offer a search.
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-5">
            <p className="font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
              Jellyseerr / Overseerr
            </p>
            <Field label="Server URL">
              <Input
                value={field('seerrUrl')}
                onChange={(e) => setForm((f) => ({ ...f, seerrUrl: e.target.value }))}
                placeholder="https://requests.example.com"
                inputMode="url"
              />
            </Field>
            <Field label={data?.hasSeerrApiKey ? 'API key (stored)' : 'API key'}>
              <Input
                type="password"
                value={form.seerrApiKey ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, seerrApiKey: e.target.value }))}
                placeholder={data?.hasSeerrApiKey ? 'Leave blank to keep the stored key' : 'Required'}
                autoComplete="off"
              />
            </Field>
            <p className="text-xs leading-relaxed text-muted-2">
              A key is required here &mdash; it&rsquo;s what lets Cinelog see whether a title has
              already been requested and submit new ones. Without it, no request button appears.
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-5">
            <Field label="Streaming region">
              <Input
                value={field('watchRegion')}
                onChange={(e) => setForm((f) => ({ ...f, watchRegion: e.target.value }))}
                placeholder="US"
                maxLength={2}
                className="w-24"
              />
            </Field>
            <p className="text-xs leading-relaxed text-muted-2">
              Two-letter country code. Streaming rights differ by country, so this decides which
              services are listed. Defaults to US.
            </p>
          </div>

          {mut.isError && (
            <p className="rounded-sm border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
              {errorMessage(mut.error)}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={mut.isPending}>
              {mut.isPending ? 'Saving…' : 'Save integrations'}
            </Button>
            {saved && (
              <span className="font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-cyan">
                Saved
              </span>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

function CreateUserCard(): JSX.Element {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('USER');

  const createMut = useMutation({
    mutationFn: () =>
      api.adminCreateUser({
        username,
        password,
        role,
        ...(email.trim() ? { email: email.trim() } : {}),
      }),
    onSuccess: () => {
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('USER');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    if (username.trim() && password) createMut.mutate();
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-4 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-content">
        Create a user
      </h2>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jane.doe" />
        </Field>
        <Field label="Email" hint="optional">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </Field>
        <Field label="Password" hint="min 8 characters">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Role">
          <RolePicker value={role} onChange={setRole} />
        </Field>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={createMut.isPending || !username.trim() || !password}>
            {createMut.isPending ? 'Creating…' : 'Create user'}
          </Button>
          {createMut.isError && (
            <span className="text-sm text-rose">{errorMessage(createMut.error)}</span>
          )}
          {createMut.isSuccess && <span className="text-sm text-cyan">User created.</span>}
        </div>
      </form>
    </Card>
  );
}

function UserList({ currentUserId }: { currentUserId: string }): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.adminListUsers(),
  });

  if (isLoading) {
    return (
      <div className="mt-6 flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2.5">
      {data?.users.map((u) => (
        <UserRow key={u.id} u={u} isSelf={u.id === currentUserId} />
      ))}
    </div>
  );
}

function UserRow({ u, isSelf }: { u: AdminUser; isSelf: boolean }): JSX.Element {
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const roleMut = useMutation({
    mutationFn: (role: UserRole) => api.adminUpdateUser(u.id, { role }),
    onSuccess: invalidate,
  });
  const passwordMut = useMutation({
    mutationFn: () => api.adminUpdateUser(u.id, { password: newPassword }),
    onSuccess: () => {
      setResetting(false);
      setNewPassword('');
      invalidate();
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.adminDeleteUser(u.id),
    onSuccess: invalidate,
  });

  const busy = roleMut.isPending || passwordMut.isPending || deleteMut.isPending;
  const anyError = roleMut.error ?? passwordMut.error ?? deleteMut.error;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-content">{u.username}</span>
            {isSelf && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] uppercase text-muted-2">
                you
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted">{u.email ?? 'no email'}</p>
          <p className="mt-0.5 text-xs text-muted-2">
            {u.libraryCount} tracked · {u.ratingCount} rated
          </p>
        </div>

        <RolePicker
          value={u.role}
          onChange={(role) => roleMut.mutate(role)}
          disabled={busy}
          compact
        />

        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setResetting((v) => !v)}>
            Reset password
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || isSelf}
            title={isSelf ? 'You cannot delete your own account' : undefined}
            className="text-rose hover:bg-rose/10 hover:text-rose"
            onClick={() => {
              if (confirm(`Delete ${u.username}? This removes all their data.`)) deleteMut.mutate();
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {resetting && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8)"
            className="max-w-xs"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={passwordMut.isPending || newPassword.length < 8}
            onClick={() => passwordMut.mutate()}
          >
            {passwordMut.isPending ? 'Saving…' : 'Set password'}
          </Button>
        </div>
      )}

      {anyError && <p className="mt-2 text-sm text-rose">{errorMessage(anyError)}</p>}
    </Card>
  );
}

function RolePicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  compact?: boolean;
}): JSX.Element {
  const roles: UserRole[] = ['USER', 'ADMIN'];
  return (
    <div className={cn('flex gap-1 rounded-xl border border-border bg-surface-2 p-1', compact ? '' : 'w-fit')}>
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => value !== r && onChange(r)}
          className={cn(
            'rounded-lg px-3 py-1 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50',
            value === r ? 'bg-gold text-ink' : 'text-muted hover:text-content',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}
