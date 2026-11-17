import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { DiscoverSection, HomeFriendEntry, HomePopularEntry } from '@cinelog/contracts';
import { api } from '../lib/api';
import { plural } from '../lib/format';
import { Avatar } from '../components/Avatar';
import { ListCard } from '../components/ListCard';
import { UserReviewCard } from '../components/ReviewsSection';
import {
  EmptyState,
  ErrorState,
  mediaHref,
  PageHeader,
  Poster,
  PosterMarks,
  PosterRail,
  SectionHeader,
} from '../components/lb';
import { buttonClass, Spinner } from '../components/ui';

/**
 * Home (`/`): what the people you follow have been watching, then the
 * instance's shelves. Browsing by filter lives on Media (`/films`).
 */
export function DiscoverPage(): JSX.Element {
  const home = useQuery({ queryKey: ['home'], queryFn: () => api.getHome() });
  const shelves = useQuery({ queryKey: ['discover'], queryFn: () => api.getDiscover(), staleTime: 10 * 60_000 });

  const h = home.data;
  const friends = h?.scope === 'FOLLOWING';
  const sections = shelves.data?.sections ?? [];
  const nothing =
    !!h &&
    !shelves.isLoading &&
    sections.length === 0 &&
    h.newFromFriends.length + h.popularWithFriends.length + h.friendReviews.length === 0 &&
    h.recentLists.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader
        title="Home"
        // The app's strip already has Media one tap away.
        className="app:hidden"
        actions={
          <Link to="/films" className={buttonClass({ size: 'sm' })}>
            Browse media
          </Link>
        }
      />

      {home.isLoading ? (
        <Spinner center />
      ) : home.isError || !h ? (
        <ErrorState title="Couldn't load Home" onRetry={() => void home.refetch()} />
      ) : nothing ? (
        <EmptyState
          title="Nothing on the shelves yet"
          body="Log something you've watched, or follow a few members, and Home fills in."
          action={
            <Link to="/members" className={buttonClass()}>
              Find members
            </Link>
          }
        />
      ) : (
        // `minmax(0,1fr)` is load-bearing: in an implicit `auto` track the
        // rails are floored by their full un-scrolled width and blow the page
        // out sideways on phones.
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
          {!friends && (
            <p className="-mb-4 border-l-2 border-cyan pl-3 text-sm text-muted">
              From around the instance —{' '}
              <Link to="/members" className="text-content underline-offset-2 hover:underline">
                follow members
              </Link>{' '}
              to make this yours.
            </p>
          )}

          {h.newFromFriends.length > 0 && (
            <section>
              <SectionHeader
                title={friends ? 'New from friends' : 'New from members'}
                more="/activity"
                moreLabel="All activity"
              />
              <PosterRail>
                {h.newFromFriends.map((e) => (
                  <FriendEntry key={e.id} entry={e} />
                ))}
              </PosterRail>
            </section>
          )}

          {h.popularWithFriends.length > 0 && (
            <section>
              <SectionHeader
                title={friends ? 'Popular with friends this week' : 'Popular this week'}
              />
              <PosterRail>
                {h.popularWithFriends.map((e) => (
                  <PopularEntry key={e.media.id} entry={e} />
                ))}
              </PosterRail>
            </section>
          )}

          {sections.map((s) => (
            <Rail key={s.key} section={s} />
          ))}

          {h.friendReviews.length > 0 && (
            <section>
              <SectionHeader title={friends ? 'Popular reviews from friends' : 'Popular reviews'} />
              <div className="grid gap-x-10 lg:grid-cols-2">
                {h.friendReviews.map((r) => (
                  <UserReviewCard key={r.id} review={r} />
                ))}
              </div>
            </section>
          )}

          {h.recentLists.length > 0 && (
            <section>
              <SectionHeader
                title={h.recentListsSource === 'FOLLOWING' ? 'Recent lists' : 'Popular lists'}
                more="/lists"
                moreLabel="All lists"
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {h.recentLists.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** One member's latest watch: the poster, who, and the marks they left on it. */
function FriendEntry({ entry: e }: { entry: HomeFriendEntry }): JSX.Element {
  const name = e.actor.displayName || e.actor.username;
  return (
    <div>
      <Poster
        title={e.media.title}
        year={e.media.year}
        type={e.media.type}
        posterUrl={e.media.posterUrl}
        to={mediaHref(e.media)}
      />
      <Link
        to={`/u/${e.actor.username}`}
        className="mt-1.5 flex items-center gap-1.5 text-xs text-muted hover:text-content"
      >
        <Avatar user={e.actor} size={18} />
        <span className="truncate">{name}</span>
      </Link>
      <div className="mt-1 min-h-4">
        <PosterMarks
          type={e.media.type}
          rating={e.rating}
          liked={e.liked}
          rewatch={e.isRewatch}
          reviewId={e.reviewId}
          watched
        />
      </div>
    </div>
  );
}

function PopularEntry({ entry: e }: { entry: HomePopularEntry }): JSX.Element {
  return (
    <Poster
      title={e.media.title}
      year={e.media.year}
      type={e.media.type}
      posterUrl={e.media.posterUrl}
      to={mediaHref(e.media)}
      caption={
        <span className="flex items-center gap-2">
          <span className="flex -space-x-1.5">
            {e.members.map((m) => (
              <Link key={m.id} to={`/u/${m.username}`} title={m.displayName || m.username}>
                <Avatar user={m} size={18} className="ring-2 !ring-bg" />
              </Link>
            ))}
          </span>
          <span className="font-data text-[11px]">{plural(e.count, 'member')}</span>
        </span>
      }
    />
  );
}

function Rail({ section }: { section: DiscoverSection }): JSX.Element {
  return (
    <section>
      <SectionHeader
        title={section.title}
        right={
          <span className="font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
            {section.source === 'CINELOG' ? 'On this instance' : 'via TMDB'}
          </span>
        }
      />
      <PosterRail>
        {section.items.map((item) => (
          <Poster
            key={`${item.provider}:${item.externalId}`}
            title={item.title}
            year={item.year}
            type={item.type}
            posterUrl={item.posterUrl}
            to={mediaHref(item)}
          />
        ))}
      </PosterRail>
    </section>
  );
}
