import { Link } from 'react-router-dom';
import type { ListSummary } from '@cinelog/contracts';
import { posterGradient } from '../lib/poster';
import { Avatar } from './Avatar';

/**
 * A list tile with a cover built from its first posters — overlapping fanned
 * cards, so a list reads as "a stack of films" at a glance.
 */
export function ListCard({ list }: { list: ListSummary }): JSX.Element {
  const posters = list.coverPosters.slice(0, 4);
  return (
    <Link
      to={`/lists/${list.id}`}
      className="group block rounded border border-border bg-surface/60 p-3 transition-colors hover:border-border-hi"
    >
      <div className="flex h-[86px] items-center justify-center overflow-hidden rounded bg-surface-2">
        {posters.length === 0 ? (
          <span className="font-cond text-[11px] font-bold uppercase tracking-wider text-muted-2">
            Empty list
          </span>
        ) : (
          <div className="flex">
            {posters.map((p, i) => (
              <div
                key={i}
                style={{ marginLeft: i === 0 ? 0 : -18, zIndex: i }}
                className="h-[86px] w-[58px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/40 transition-transform group-hover:translate-y-[-2px]"
              >
                {p ? (
                  <img src={p} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="block h-full w-full"
                    style={{ background: posterGradient(list.title + i) }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <h3 className="mt-2.5 truncate font-cond text-[15px] font-bold uppercase tracking-tight text-content group-hover:text-gold">
        {list.title}
      </h3>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-2">
        <Avatar
          user={{ username: list.owner.username, avatarUrl: list.owner.avatarUrl }}
          size={16}
        />
        <span className="truncate">{list.owner.displayName || list.owner.username}</span>
        <span>·</span>
        <span className="tabular-nums">{list.itemCount} films</span>
        {list.likeCount > 0 && (
          <>
            <span>·</span>
            <span className="tabular-nums text-rose">♥ {list.likeCount}</span>
          </>
        )}
        {!list.isPublic && (
          <>
            <span>·</span>
            <span className="text-muted">Private</span>
          </>
        )}
      </div>
    </Link>
  );
}
