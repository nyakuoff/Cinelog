import type { UserPublic } from '@cinelog/contracts';
import { cn } from '../lib/cn';

export function Avatar({
  user,
  size = 32,
  className,
}: {
  user: UserPublic | null | undefined;
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
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: 'linear-gradient(140deg, rgb(var(--gold)), rgb(var(--cyan)))',
      }}
      className={cn('grid shrink-0 place-items-center rounded-full font-extrabold text-ink', className)}
    >
      {initials}
    </span>
  );
}
