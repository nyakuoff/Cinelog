import { Link } from 'react-router-dom';
import type { ListSummary } from '@cinelog/contracts';
import { posterGradient } from '../lib/poster';
import { Avatar } from './Avatar';

/**
 * A list tile with a cover built from its first posters — overlapping fanned
 * cards, so a list reads as "a stack of films" at a glance.
 */
export function ListCard({ list }: { list: ListSummary }): JSX.Element {
  // The API sends up to 4 cover posters; beyond that a "+N" tile on the end
  // stands in for the rest, so a 1-item list doesn't look sparse and a
  // 40-item list doesn't overflow its tile.
  const posters = list.coverPosters.slice(0, 4);
  const overflow = list.itemCount - posters.length;
  const single = posters.length === 1;

  return (
    <Link
      to={`/lists/${list.id}`}
      className="group block rounded-sm border border-border bg-surface p-3 transition-colors hover:border-gold"
    >
      <div className="flex h-[86px] items-center justify-center overflow-hidden rounded-sm bg-bg-2">
        {posters.length === 0 ? (
          <span className="font-cond text-[11px] font-bold uppercase tracking-wider text-muted-2">
            Empty list
          </span>
        ) : (
          <div className="flex">
            {posters.map((p, i) => (
              <div
                key={i}
                style={{ marginLeft: i === 0 || single ? 0 : -18, zIndex: i }}
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
            {overflow > 0 && (
              <div
                style={{ marginLeft: -18, zIndex: posters.length }}
                className="grid h-[86px] w-[58px] shrink-0 place-items-center overflow-hidden rounded-[2px] bg-black/70 ring-1 ring-black/40"
              >
                <span className="font-data text-[13px] font-bold text-content">+{overflow}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <h3 className="mt-2.5 truncate font-cond text-[15px] font-extrabold uppercase tracking-[0.04em] text-content group-hover:text-gold">
        {list.title}
      </h3>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-2">
        <Avatar
          user={{ username: list.owner.username, avatarUrl: list.owner.avatarUrl }}
          size={16}
        />
        <span className="truncate">{list.owner.displayName || list.owner.username}</span>
        <span>·</span>
        <span className="font-data">
          {list.itemCount} {list.itemCount === 1 ? 'title' : 'titles'}
        </span>
        {list.likeCount > 0 && (
          <>
            <span>·</span>
            <span className="font-data text-rose">♥ {list.likeCount}</span>
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
