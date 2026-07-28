import { cn } from '../lib/cn';

type AvatarUser = { username: string; avatarUrl: string | null };

export function Avatar({
  user,
  size = 32,
  className,
}: {
  user: AvatarUser | null | undefined;
  size?: number;
  className?: string;
}): JSX.Element {
  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase();

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        style={{ width: size, height: size }}
        className={cn('shrink-0 rounded-sm object-cover ring-1 ring-border-hi/60', className)}
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-sm bg-surface-2 font-cond font-extrabold uppercase text-gold ring-1 ring-border-hi',
        className,
      )}
    >
      {initials}
    </span>
  );
}
