import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { UserPublic } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { posterGradient } from '../lib/poster';
import { Avatar } from '../components/Avatar';
import { Field } from '../components/Field';
import { Button, Card, Input, Spinner } from '../components/ui';

export function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  if (!user) return <></>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.2em] text-gold">
        Your account
      </p>
      <h1 className="font-cond text-3xl font-extrabold uppercase tracking-tight">Profile</h1>

      <BannerAndAvatar user={user} />

      <div className="mt-8 space-y-6">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
    </div>
  );
}

function BannerAndAvatar({ user }: { user: UserPublic }): JSX.Element {
  const { updateUser } = useAuth();
  const bannerRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const bannerMut = useMutation({ mutationFn: (file: File) => api.uploadBanner(file), onSuccess: updateUser });
  const removeBannerMut = useMutation({ mutationFn: () => api.removeBanner(), onSuccess: updateUser });
  const avatarMut = useMutation({ mutationFn: (file: File) => api.uploadAvatar(file), onSuccess: updateUser });
  const removeAvatarMut = useMutation({ mutationFn: () => api.removeAvatar(), onSuccess: updateUser });

  const bannerBusy = bannerMut.isPending || removeBannerMut.isPending;
  const avatarBusy = avatarMut.isPending || removeAvatarMut.isPending;
  const error = bannerMut.error ?? avatarMut.error;

  return (
    <div className="mt-6">
      {/* Outer wrapper has no overflow-hidden, so the avatar (which overlaps the
          banner's bottom edge) never gets clipped by the banner's own rounding. */}
      <div className="relative">
        <div
          className="h-40 overflow-hidden rounded-2xl border border-border bg-surface-2 sm:h-52"
          style={!user.bannerUrl ? { background: posterGradient(user.username) } : undefined}
        >
          {user.bannerUrl && (
            <img src={user.bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {bannerBusy && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/40">
              <Spinner />
            </div>
          )}

          <div className="absolute bottom-3 right-3 flex gap-2">
            {user.bannerUrl && (
              <Button size="sm" variant="secondary" onClick={() => removeBannerMut.mutate()}>
                Remove
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => bannerRef.current?.click()}>
              Change banner
            </Button>
          </div>
          <input
            ref={bannerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) bannerMut.mutate(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Avatar, overlapping the banner's bottom-left corner — sibling of the
            clipped banner box, so it renders fully on top of it. */}
        <div className="absolute -bottom-8 left-5 z-10">
          <div className="relative">
            <div className="rounded-full ring-4 ring-bg">
              <Avatar user={user} size={80} />
            </div>
            {avatarBusy && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
                <Spinner className="h-4 w-4" />
              </div>
            )}
            <button
              onClick={() => avatarRef.current?.click()}
              title="Change avatar"
              className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-gold text-xs text-ink shadow-soft hover:brightness-110"
            >
              ✎
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) avatarMut.mutate(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </div>
      <div className="h-10" />
      {error && (
        <p className="text-sm text-rose">
          {error instanceof ApiError ? error.message : 'Could not update image'}
        </p>
      )}
    </div>
  );
}

function ProfileForm({ user }: { user: UserPublic }): JSX.Element {
  const { updateUser } = useAuth();
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [saved, setSaved] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      api.updateProfile({
        username: username !== user.username ? username : undefined,
        email: email !== (user.email ?? '') ? email || null : undefined,
        bio: bio !== (user.bio ?? '') ? bio || null : undefined,
      }),
    onSuccess: (u) => {
      updateUser(u);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    mut.mutate();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
        Profile details
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Email" hint="optional">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Bio" hint={`${bio.length}/500`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Tell people what you like to watch…"
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
        </Field>

        {mut.isError && (
          <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {mut.error instanceof ApiError ? mut.error.message : 'Could not save changes'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          {saved && <span className="text-sm text-cyan">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

function PasswordForm(): JSX.Element {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;

  const mut = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    if (next.length >= 8 && next === confirm) mut.mutate();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
        Change password
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Current password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" hint="at least 8 characters">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : null}>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        {mut.isError && (
          <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {mut.error instanceof ApiError ? mut.error.message : 'Could not change password'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="secondary"
            disabled={mut.isPending || next.length < 8 || next !== confirm || !current}
          >
            {mut.isPending ? 'Updating…' : 'Update password'}
          </Button>
          {saved && <span className="text-sm text-cyan">Updated</span>}
        </div>
      </form>
    </Card>
  );
}
