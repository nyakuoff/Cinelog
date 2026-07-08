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
      <h1 className="font-cond text-3xl font-extrabold uppercase tracking-tight">User management</h1>
      <p className="mt-1 text-sm text-muted">
        Create accounts, change roles, reset passwords, and remove users.
      </p>

      <CreateUserCard />
      <UserList currentUserId={user?.id ?? ''} />
    </div>
  );
}

// -------------------------------------------------------------------------

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
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted-2">
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
            'rounded-lg px-3 py-1 font-cond text-[12px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50',
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
