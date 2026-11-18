import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
  CreditPerson,
  MediaDetail,
  TrackingResponse,
  TrackingStatus,
} from '@cinelog/contracts';
import { scaleForMediaType } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { invalidateUserMedia } from '../lib/invalidate';
import { useAuth } from '../lib/auth';
import { useAppShell, useGoBack, useScreenHeader } from '../lib/appShell';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { formatDate, localDateString } from '../lib/format';
import {
  IconChevronLeft,
  IconClock,
  IconDots,
  IconEdit,
  IconEye,
  IconHeart,
  IconList,
  IconPlay,
  IconPlus,
  IconShare,
} from '../components/app/Icons';
import { Button, buttonClass, LoadMore, Spinner, StampToggle } from '../components/ui';
import { useConfirm } from '../components/Dialog';
import { RatingHistogram, RatingMark, StarInput } from '../components/Rating';
import { StatusPicker } from '../components/StatusPicker';
import { EpisodesSection } from '../components/EpisodesSection';
import { ArtworkPickerModal } from '../components/ArtworkPickerModal';
import { RematchModal } from '../components/RematchModal';
import { EditCastModal } from '../components/EditCastModal';
import { ReviewsSection } from '../components/ReviewsSection';
import { LogModal } from '../components/LogModal';
import { AddToListsDialog } from '../components/AddToListsDialog';
import { ListCard } from '../components/ListCard';
import { WhereToWatch } from '../components/WhereToWatch';
import {
  Accession,
  EmptyState,
  ErrorState,
  formatRuntime,
  isEpisodic as isEpisodicType,
  mediaHref,
  Poster,
  PosterGrid,
  SectionHeader,
  TabBar,
  Tag,
  TYPE_LABEL,
} from '../components/lb';
import { Avatar } from '../components/Avatar';

type InfoTab = 'cast' | 'crew' | 'details' | 'genres';

export function MediaDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const appShell = useAppShell();
  const goBack = useGoBack();

  /* A film's own artwork is the header on a phone — it runs under the status
     bar, so the shell's title bar would only be in its way. This screen draws
     its own back control over the backdrop instead. */
  useScreenHeader({ hidden: true });

  /**
   * Artwork choices belong to a library, so they're only shown — and only
   * editable — when you got here from one. `libraryOf` names whose library
   * view this is; you can edit only your own.
   */
  const libraryOf = params.get('libraryOf');
  const canEditArtwork = !!libraryOf && libraryOf === user?.username;
  const [editingArtwork, setEditingArtwork] = useState(false);
  const [fixingMismatch, setFixingMismatch] = useState(false);
  const [editingCast, setEditingCast] = useState(false);
  const [logging, setLogging] = useState(false);
  const [infoTab, setInfoTab] = useState<InfoTab>('cast');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['media', id, libraryOf],
    queryFn: () => api.getMedia(id, libraryOf ?? undefined),
    enabled: id.length > 0,
  });

  const invalidate = (): void => invalidateUserMedia(queryClient, id);
  // Apply the returned state at once, so the controls never read stale state
  // while the refetch is in flight (a second tap would act on the old value).
  const applyState = (res: TrackingResponse): void => {
    queryClient.setQueryData<MediaDetail>(['media', id, libraryOf], (old) =>
      old ? { ...old, userState: res.userState } : old,
    );
    invalidate();
  };

  const statusMut = useMutation({
    mutationFn: (status: TrackingStatus | null) => api.setStatus({ mediaId: id }, status),
    onSuccess: applyState,
  });
  const favoriteMut = useMutation({
    mutationFn: (value: boolean) => api.setFavorite({ mediaId: id }, value),
    onSuccess: applyState,
  });
  const watchlistMut = useMutation({
    mutationFn: (value: boolean) => api.setWatchlist({ mediaId: id }, value),
    onSuccess: applyState,
  });
  // The Watched control is a toggle, so it needs the un-watch path too —
  // previously it could only ever be switched on.
  const watchMut = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? // Date-only on the server, like every logged watch: today, in the viewer's zone.
          api.markWatched({ mediaId: id, watchedAt: `${localDateString()}T12:00:00.000Z` })
        : api.unmarkWatched({ mediaId: id }),
    onSuccess: applyState,
  });
  // isPending only flips after the observer's next tick, so a fast double
  // click can slip past it; this is set synchronously.
  const watchBusy = useRef(false);
  const ratingMut = useMutation({
    mutationFn: (value: number | null) => api.setRating({ mediaId: id }, value),
    onSuccess: invalidate,
  });

  if (isLoading) return <Spinner center />;

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    // The app shell's title bar is hidden on this screen, so "Go back" is its only way out.
    const back = (
      <Button variant="ghost" onClick={goBack}>
        Go back
      </Button>
    );
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {notFound ? (
          <EmptyState
            title="Title not found"
            body="It may have been removed or rematched."
            action={back}
          />
        ) : (
          <ErrorState
            title="Could not load this title"
            onRetry={() => void refetch()}
            action={back}
          />
        )}
      </div>
    );
  }

  const m = data;
  const state = m.userState;
  const watched = state.status === 'COMPLETED' || state.rewatchCount > 0;
  // Un-watching also deletes the rating server-side, so say so first. Ignored
  // while a toggle is in flight so a double tap can't write two diary rows.
  const toggleWatched = async (): Promise<void> => {
    if (watchBusy.current) return;
    watchBusy.current = true;
    const release = (): void => {
      watchBusy.current = false;
    };
    if (
      watched &&
      state.rating !== null &&
      !(await confirm({
        title: 'Remove from watched?',
        body: 'This also removes your rating.',
        confirmLabel: 'Remove',
        danger: true,
      }))
    ) {
      return release();
    }
    watchMut.mutate(!watched, { onSettled: release });
  };
  const isEpisodic = isEpisodicType(m.type);
  // A show has a creator, not a director; the credit line says which.
  const creditLabel = isEpisodic ? 'Created by' : 'Directed by';
  const scale = scaleForMediaType(m.type);
  const directors = m.crew.filter((c) => c.role === 'Director' || c.role === 'Creator');

  const infoTabs = [
    { key: 'cast', label: 'Cast', count: m.cast.length || undefined },
    { key: 'crew', label: 'Crew', count: m.crew.length || undefined },
    { key: 'details', label: 'Details' },
    { key: 'genres', label: 'Genres' },
  ];

  return (
    <div className={appShell ? undefined : 'pb-20'}>
      {appShell ? (
        <AppFilmScreen
          media={m}
          scale={scale}
          directors={directors}
          creditLabel={creditLabel}
          canEditArtwork={canEditArtwork}
          isAdmin={user?.role === 'ADMIN'}
          onWatch={() => void toggleWatched()}
          watchPending={watchMut.isPending}
          onLike={() => favoriteMut.mutate(!state.isFavorite)}
          onWatchlist={() => watchlistMut.mutate(!state.isWatchlisted)}
          onRate={(v) => ratingMut.mutate(v)}
          onStatus={(s) => statusMut.mutate(s)}
          onLog={() => setLogging(true)}
          onEditArtwork={() => setEditingArtwork(true)}
          onFixMismatch={() => setFixingMismatch(true)}
          onEditCast={() => setEditingCast(true)}
        />
      ) : (
        /* Full-bleed backdrop fading into the page — the film's own image is the
         header, with the poster overlapping its lower edge. */
        <div className="relative">
          {m.backdropUrl && (
            <div className="absolute inset-x-0 top-0 h-[300px] overflow-hidden sm:h-[440px]">
              <img
                src={m.backdropUrl}
                alt=""
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover object-top"
              />
              {/* One gradient, weighted to the bottom, so the image stays legible
                at the top and only fades where text begins. */}
              <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-transparent to-bg" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
            </div>
          )}

          <div
            className={cn(
              'relative mx-auto max-w-6xl px-4 sm:px-6',
              m.backdropUrl ? 'pt-40 sm:pt-64' : 'pt-10',
            )}
          >
            <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)_260px]">
              {/* Poster + action panel */}
              <div className="flex items-end gap-5 lg:block">
                <div className="group relative w-28 shrink-0 sm:w-40 lg:w-full">
                  <div className="aspect-[2/3] overflow-hidden rounded ring-1 ring-border-hi/60 shadow-soft">
                    {m.posterUrl ? (
                      <img
                        src={m.posterUrl}
                        alt={m.title}
                        decoding="async"
                        fetchPriority="high"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: posterGradient(m.title) }}
                      />
                    )}
                  </div>
                  {canEditArtwork && (
                    <Button
                      size="icon"
                      onClick={() => setEditingArtwork(true)}
                      title="Change artwork in your library"
                      aria-label="Change artwork in your library"
                      className="absolute bottom-2 right-2 !bg-bg-2 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 coarse:opacity-100"
                    >
                      <IconEdit />
                    </Button>
                  )}
                </div>

                {/* Under the poster sits where-to-watch; the record card moved to
                  the right rail, above the community ratings it belongs beside. */}
                {/* Where to watch, and the trailer directly beneath it: both
                  answer "can I see this now", so they belong together rather
                  than with the catalogue coordinates. */}
                <div className="min-w-0 flex-1 space-y-2 lg:mt-4">
                  <WhereToWatch media={m} />
                  {m.trailerUrl && <TrailerLink url={m.trailerUrl} className="w-full" />}
                </div>
              </div>

              {/* Main column */}
              <div className="min-w-0">
                {directors.length > 0 && (
                  <p className="font-cond text-[13px] font-bold uppercase tracking-[0.16em] text-muted-2">
                    {creditLabel}
                  </p>
                )}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="font-cond text-4xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-5xl">
                    {m.title}
                  </h1>
                  {m.releaseDate && (
                    <span className="font-cond text-2xl font-bold tabular-nums text-muted">
                      {m.releaseDate.slice(0, 4)}
                    </span>
                  )}
                </div>
                {directors.length > 0 && (
                  <p className="mt-1 text-sm text-content/90">
                    {directors.map((d, i) => (
                      <span key={d.id}>
                        {i > 0 && ', '}
                        <Link to={personPath(d)} className="hover:text-gold hover:underline">
                          {d.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}

                {/* Accession line — the catalogue coordinates for this record,
                  and genuinely the id you'd search the provider for. */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <Accession provider={m.provider} externalId={m.externalId} runtime={m.runtime} />
                  <span className="font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
                    {TYPE_LABEL[m.type]}
                  </span>
                  {user?.role === 'ADMIN' && (
                    <Button variant="link" size="sm" onClick={() => setFixingMismatch(true)}>
                      Wrong title?
                    </Button>
                  )}
                </div>

                {m.tagline && (
                  <p className="mt-5 font-cond text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
                    {m.tagline}
                  </p>
                )}
                {m.overview && (
                  <p className="mt-2 max-w-[62ch] leading-relaxed text-content/90">{m.overview}</p>
                )}

                <div className="mt-7">
                  <TabBar
                    tabs={infoTabs}
                    active={infoTab}
                    onChange={(k) => setInfoTab(k as InfoTab)}
                  />
                  <div className="pt-4">
                    {infoTab === 'cast' && (
                      <CastGrid
                        people={m.cast}
                        emptyLabel="No cast recorded for this title."
                        canEdit={user?.role === 'ADMIN'}
                        onEdit={() => setEditingCast(true)}
                      />
                    )}
                    {infoTab === 'crew' && (
                      <CastGrid people={m.crew} emptyLabel="No crew recorded for this title." />
                    )}
                    {infoTab === 'details' && <DetailsList media={m} />}
                    {infoTab === 'genres' && <GenreChips media={m} />}
                  </div>
                </div>
              </div>

              {/* Right rail: community ratings + stats */}
              <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                <ActionPanel
                  media={m}
                  scale={scale}
                  onWatch={() => void toggleWatched()}
                  watchPending={watchMut.isPending}
                  onLike={() => favoriteMut.mutate(!state.isFavorite)}
                  onWatchlist={() => watchlistMut.mutate(!state.isWatchlisted)}
                  onRate={(v) => ratingMut.mutate(v)}
                  onStatus={(s) => statusMut.mutate(s)}
                  onLog={() => setLogging(true)}
                />
                <RatingsPanel media={m} />
                <FriendRatingsPanel mediaId={id} type={m.type} />
                <StatsPanel media={m} />
              </aside>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          'mx-auto mt-12 max-w-6xl space-y-12 px-4 sm:px-6',
          appShell && 'mt-8 space-y-8',
        )}
      >
        {isEpisodic && <EpisodesSection mediaId={id} scale={scale} />}
        <ReviewsSection mediaId={id} scale={scale} ownReview={m.ownReview} />
        <ListsContaining mediaId={id} />
        <SimilarSection mediaId={id} isEpisodic={isEpisodic} />
      </div>

      {editingArtwork && (
        <ArtworkPickerModal mediaId={id} onClose={() => setEditingArtwork(false)} />
      )}
      {fixingMismatch && user?.role === 'ADMIN' && (
        <RematchModal
          mediaId={id}
          currentTitle={m.title}
          onClose={() => setFixingMismatch(false)}
        />
      )}
      {editingCast && (
        <EditCastModal mediaId={id} cast={m.cast} onClose={() => setEditingCast(false)} />
      )}
      {logging && <LogModal media={m} onClose={() => setLogging(false)} />}
    </div>
  );
}

/**
 * The film screen as the installed app draws it.
 *
 * Same record, one column, ordered by what you came to do. The backdrop runs
 * to the top edge under the status bar with the title struck over its fade
 * and the poster beside it; directly under that, the four things you do to a
 * title — watched, like, watchlist, log — as thumb-sized tiles, then your
 * stars. Reading matter (synopsis, ratings, credits) comes after. Nothing is
 * pinned: a second fixed bar over the tab bar cost a sixth of the screen on
 * every scroll for actions you take once.
 */
function AppFilmScreen({
  media: m,
  scale,
  directors,
  creditLabel,
  canEditArtwork,
  isAdmin,
  onWatch,
  watchPending,
  onLike,
  onWatchlist,
  onRate,
  onStatus,
  onLog,
  onEditArtwork,
  onFixMismatch,
  onEditCast,
}: {
  media: MediaDetail;
  scale: ReturnType<typeof scaleForMediaType>;
  directors: CreditPerson[];
  creditLabel: string;
  canEditArtwork: boolean;
  isAdmin: boolean;
  onWatch: () => void;
  watchPending: boolean;
  onLike: () => void;
  onWatchlist: () => void;
  onRate: (value: number | null) => void;
  onStatus: (status: TrackingStatus | null) => void;
  onLog: () => void;
  onEditArtwork: () => void;
  onFixMismatch: () => void;
  onEditCast: () => void;
}): JSX.Element {
  const goBack = useGoBack();
  const state = m.userState;
  const [infoTab, setInfoTab] = useState<InfoTab>('cast');
  const watched = state.status === 'COMPLETED' || state.rewatchCount > 0;

  return (
    <>
      {/* ---- Hero ---------------------------------------------------- */}
      <div className="relative">
        <div className="h-[30vh] min-h-[200px] w-full overflow-hidden">
          {m.backdropUrl ? (
            <img
              src={m.backdropUrl}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="h-full w-full" style={{ background: posterGradient(m.title) }} />
          )}
        </div>
        {/* Weighted to the foot: the image stays readable up top and only
            dissolves where the title lands on it. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/55 via-bg/10 to-bg" />

        {/* Screen controls, over the art. They scroll away with it rather than
            floating — nothing in this world hovers. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2 pt-safe">
          <Button size="icon" onClick={goBack} aria-label="Back" className={OVER_ART}>
            <IconChevronLeft />
          </Button>
          <RecordMenu
            canEditArtwork={canEditArtwork}
            isAdmin={isAdmin}
            onEditArtwork={onEditArtwork}
            onFixMismatch={onFixMismatch}
            onEditCast={onEditCast}
          />
        </div>
      </div>

      {/* ---- Title block, overlapping the fade ----------------------- */}
      <div className="relative -mt-16 px-4">
        <div className="flex items-end gap-3.5">
          <div className="min-w-0 flex-1">
            <h1 className="font-cond text-[27px] font-extrabold uppercase leading-[0.94] tracking-tight">
              {m.title}
            </h1>
            <p className="mt-1.5 font-cond text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
              {m.releaseDate && <span className="tabular-nums">{m.releaseDate.slice(0, 4)}</span>}
              {m.releaseDate && directors.length > 0 && <span className="px-1.5">·</span>}
              {directors.length > 0 && (
                <>
                  <span className="text-muted-2">{creditLabel} </span>
                  {directors.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      <Link to={personPath(d)} className="text-content">
                        {d.name}
                      </Link>
                    </span>
                  ))}
                </>
              )}
            </p>
          </div>

          <div className="w-[88px] shrink-0 overflow-hidden rounded-sm bg-card shadow-lift ring-1 ring-border-hi/60">
            <div className="aspect-[2/3]">
              {m.posterUrl ? (
                <img
                  src={m.posterUrl}
                  alt={m.title}
                  decoding="async"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full" style={{ background: posterGradient(m.title) }} />
              )}
            </div>
          </div>
        </div>

        {/* Trailer and length, the two "can I watch this now" facts, on one rule. */}
        <div className="mt-4 flex items-center gap-2.5 border-y border-border py-2.5">
          {m.trailerUrl && <TrailerLink url={m.trailerUrl} size="sm" />}
          {m.runtime && (
            <span className="font-data text-[13px] text-muted">{formatRuntime(m.runtime)}</span>
          )}
          <span className="ml-auto font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
            {TYPE_LABEL[m.type]}
          </span>
        </div>

        {/* ---- What you do to a title ----------------------------------- */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <ActionTile
            label="Watched"
            icon={<IconEye className="h-6 w-6" />}
            active={watched}
            tone="text-cyan"
            onClick={onWatch}
            disabled={watchPending}
          />
          <ActionTile
            label="Like"
            icon={<IconHeart filled={state.isFavorite} className="h-6 w-6" />}
            active={state.isFavorite}
            tone="text-rose"
            onClick={onLike}
          />
          <ActionTile
            label="Watchlist"
            icon={<IconClock className="h-6 w-6" />}
            active={state.isWatchlisted}
            tone="text-gold"
            onClick={onWatchlist}
          />
          <button
            type="button"
            onClick={onLog}
            className="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-sm bg-gold text-ink active:opacity-80"
          >
            <IconPlus className="h-6 w-6" />
            <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em]">Log</span>
          </button>
        </div>

        <StarInput value={state.rating} scale={scale} onChange={onRate} align="center" className="mt-4" />
        {isEpisodicType(m.type) && (
          <div className="mt-3">
            <StatusPicker value={state.status} onChange={onStatus} className="w-full" />
          </div>
        )}
        {/* Lists + share side by side; the activity line spans beneath. */}
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-sm border border-border [&>button+button]:border-l [&>button]:border-t-0 [&>p]:col-span-2">
          <RecordActions media={m} />
        </div>

        {m.tagline && (
          <p className="mt-6 font-cond text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
            {m.tagline}
          </p>
        )}
        {m.overview && <Synopsis text={m.overview} />}

        <Accession provider={m.provider} externalId={m.externalId} className="mt-4" />
      </div>

      {/* ---- Record, ratings, credits -------------------------------- */}
      <div className="mt-7 space-y-7 px-4">
        <WhereToWatch media={m} />
        <RatingsPanel media={m} />
        <FriendRatingsPanel mediaId={m.id} type={m.type} />
        <StatsPanel media={m} />

        <div>
          <TabBar
            tabs={[
              { key: 'cast', label: 'Cast', count: m.cast.length || undefined },
              { key: 'crew', label: 'Crew', count: m.crew.length || undefined },
              { key: 'details', label: 'Details' },
              { key: 'genres', label: 'Genres' },
            ]}
            active={infoTab}
            onChange={(k) => setInfoTab(k as InfoTab)}
          />
          <div className="pt-4">
            {infoTab === 'cast' && (
              <CastGrid
                people={m.cast}
                emptyLabel="No cast recorded for this title."
                canEdit={isAdmin}
                onEdit={onEditCast}
              />
            )}
            {infoTab === 'crew' && (
              <CastGrid people={m.crew} emptyLabel="No crew recorded for this title." />
            )}
            {infoTab === 'details' && <DetailsList media={m} />}
            {infoTab === 'genres' && <GenreChips media={m} />}
          </div>
        </div>
      </div>

    </>
  );
}

/** One of the film screen's four action tiles: ruled when unset, inked in its
 *  stamp colour when set — the same grammar as a stamp, at thumb size. */
function ActionTile({
  label,
  icon,
  active,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  icon: JSX.Element;
  active: boolean;
  tone: string;
  onClick: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-sm border active:bg-surface-2 disabled:opacity-60',
        active ? cn('border-current', tone) : 'border-border text-muted',
      )}
    >
      {icon}
      <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
    </button>
  );
}

/**
 * A synopsis that opens. Full plot text is four or five paragraphs of a phone
 * screen and it sits between the title and everything you came to do, so it
 * starts folded and unfolds on request rather than being truncated for good.
 */
function Synopsis({ text }: { text: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <p className={cn('text-[15px] leading-relaxed text-content/90', !open && 'line-clamp-4')}>
        {text}
      </p>
      <Button variant="link" size="sm" className="mt-1.5" onClick={() => setOpen((v) => !v)}>
        {open ? 'Less' : 'More'}
      </Button>
    </div>
  );
}

/** The screen's own overflow menu — the record edits that used to be scattered
 *  through a desktop page's margins, gathered where a phone can reach them. */
function RecordMenu({
  canEditArtwork,
  isAdmin,
  onEditArtwork,
  onFixMismatch,
  onEditCast,
}: {
  canEditArtwork: boolean;
  isAdmin: boolean;
  onEditArtwork: () => void;
  onFixMismatch: () => void;
  onEditCast: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const items: { label: string; run: () => void }[] = [
    ...(isAdmin ? [{ label: 'Wrong title?', run: onFixMismatch }] : []),
    ...(canEditArtwork ? [{ label: 'Change artwork', run: onEditArtwork }] : []),
    ...(isAdmin ? [{ label: 'Edit cast', run: onEditCast }] : []),
  ];

  if (items.length === 0) return <span />;

  return (
    <div className="relative" ref={ref}>
      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className={OVER_ART}
      >
        <IconDots className="h-5 w-5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-sm border border-border-hi bg-surface p-1 shadow-lift"
        >
          {items.map((i) => (
            <button
              key={i.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                i.run();
              }}
              className="block w-full rounded-sm px-2.5 py-2.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-content"
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The record card under the poster. Each state is a stamp struck onto the
 * record rather than a lit chip — pressing one plays the single authored
 * motion in the app, so marking a title watched actually feels like marking it.
 */
function ActionPanel({
  media,
  scale,
  onWatch,
  watchPending,
  onLike,
  onWatchlist,
  onRate,
  onStatus,
  onLog,
}: {
  media: MediaDetail;
  scale: ReturnType<typeof scaleForMediaType>;
  onWatch: () => void;
  watchPending: boolean;
  onLike: () => void;
  onWatchlist: () => void;
  onRate: (value: number | null) => void;
  onStatus: (status: TrackingStatus | null) => void;
  onLog: () => void;
}): JSX.Element {
  const state = media.userState;
  const watched = state.status === 'COMPLETED' || state.rewatchCount > 0;
  return (
    <div className="overflow-hidden rounded-sm border border-border-hi bg-surface text-center">
      <p className="border-b border-border px-3 py-1.5 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
        Your record
      </p>

      <div className="flex items-stretch gap-1 p-2">
        <StampToggle
          label="Watched"
          active={watched}
          tone="cyan"
          onChange={onWatch}
          disabled={watchPending}
          className="flex-1"
        />
        <StampToggle
          label="Liked"
          active={state.isFavorite}
          tone="rose"
          onChange={onLike}
          className="flex-1"
        />
        <StampToggle
          label="Watchlist"
          active={state.isWatchlisted}
          tone="gold"
          onChange={onWatchlist}
          className="flex-1"
        />
      </div>

      <div className="border-t border-border px-2 py-3">
        <p className="mb-1 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
          {state.rating === null ? 'Rate' : 'Your rating'}
        </p>
        <StarInput value={state.rating} scale={scale} onChange={onRate} align="center" />
      </div>

      {/* Watching / on hold / dropped only mean something across episodes. */}
      {isEpisodicType(media.type) && (
        <div className="border-t border-border px-3 py-3">
          <StatusPicker value={state.status} onChange={onStatus} className="w-full" />
        </div>
      )}

      <div className="border-t border-border p-2">
        <Button variant="primary" className="w-full" onClick={onLog}>
          Review or log…
        </Button>
      </div>

      <RecordActions media={media} />
    </div>
  );
}

const ACTION_ROW =
  'flex min-h-[2.75rem] w-full items-center justify-center gap-2 border-t border-border px-3 font-cond text-[13px] font-bold uppercase tracking-[0.09em] text-muted hover:bg-surface-2 hover:text-content focus:outline-none focus-visible:bg-surface-2 focus-visible:text-content';

/**
 * The rest of the record card, shared by both shells: add to lists, share,
 * and the line that says how often you've logged this.
 */
function RecordActions({ media }: { media: MediaDetail }): JSX.Element {
  const [listing, setListing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { watchCount = 0, lastWatchedAt, status, rating } = media.userState;

  async function share(): Promise<void> {
    // Without `?libraryOf`, which is about whose artwork you were looking at.
    const url = `${window.location.origin}/media/${media.id}`;
    try {
      if (navigator.share) return await navigator.share({ title: media.title, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* share sheet dismissed, or clipboard denied — nothing to report */
    }
  }

  const activity =
    watchCount > 0
      ? `Watched ${watchCount === 1 ? 'once' : `${watchCount} times`}${
          lastWatchedAt
            ? `${watchCount === 1 ? '' : ', last'} on ${formatDate(lastWatchedAt, { dateOnly: true })}`
            : ''
        }`
      : status === 'COMPLETED' || rating !== null
        ? 'Watched — no diary entry'
        : null;

  return (
    <>
      <button
        type="button"
        className={cn(ACTION_ROW, 'first:border-t-0')}
        onClick={() => setListing(true)}
      >
        <IconList /> Add to lists…
      </button>
      <button type="button" className={ACTION_ROW} onClick={() => void share()}>
        <IconShare />
        <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
      </button>
      {activity && (
        <p className="border-t border-border px-3 py-2.5 text-center font-data text-[11px] text-muted-2">
          <span className="mr-1.5 font-cond font-bold uppercase tracking-[0.14em]">
            Your activity
          </span>
          {activity}
        </p>
      )}
      {listing && (
        <AddToListsDialog
          mediaId={media.id}
          title={media.title}
          onClose={() => setListing(false)}
        />
      )}
    </>
  );
}

/** Opens the trailer off-site. One look for it in both shells. */
function TrailerLink({
  url,
  size = 'md',
  className,
}: {
  url: string;
  size?: 'sm' | 'md';
  className?: string;
}): JSX.Element {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={buttonClass({ variant: 'secondary', size, className })}
    >
      <IconPlay className="h-3.5 w-3.5" /> Trailer
    </a>
  );
}

/** Controls drawn over artwork need their own solid ground — matte, not glass. */
const OVER_ART = '!border-border-hi !bg-bg-2 !text-content';

/** Community rating average + distribution histogram. */
function RatingsPanel({ media }: { media: MediaDetail }): JSX.Element {
  return (
    <div>
      <SectionHeader title="Ratings" />
      {media.ratingCount === 0 ? (
        <p className="text-sm text-muted-2">No ratings yet.</p>
      ) : (
        <div className="flex items-start gap-3">
          {/* An average is the archive's arithmetic, not your mark: plain ink. */}
          <RatingMark
            value={media.communityRating ?? 0}
            type={media.type}
            display="number"
            average
            size={24}
            className="mt-6 shrink-0"
          />
          <RatingHistogram
            buckets={media.ratingDistribution}
            type={media.type}
            average
            className="min-w-0 flex-1"
          />
        </div>
      )}
    </div>
  );
}

/** Ratings from people the viewer follows — Letterboxd's "Friends" panel. */
function FriendRatingsPanel({
  mediaId,
  type,
}: {
  mediaId: string;
  type: MediaDetail['type'];
}): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['friend-ratings', mediaId],
    queryFn: () => api.getFriendRatings(mediaId),
  });

  if (!data || data.ratings.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Ratings from people you follow" />
      <ul className="space-y-2.5">
        {data.ratings.map((r) => (
          <li key={r.user.username} className="flex items-center gap-2.5">
            <Link to={`/u/${r.user.username}`} className="shrink-0">
              <Avatar user={{ username: r.user.username, avatarUrl: r.user.avatarUrl }} size={28} />
            </Link>
            <Link
              to={`/u/${r.user.username}`}
              className="min-w-0 flex-1 truncate text-sm text-content hover:text-gold"
            >
              {r.user.displayName || r.user.username}
            </Link>
            <RatingMark value={r.ratingValue} type={type} size={12} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatsPanel({ media }: { media: MediaDetail }): JSX.Element {
  const rows = [
    { label: 'Watched by', value: media.watchedCount },
    { label: 'Liked by', value: media.likedCount },
    { label: 'Reviews', value: media.reviewCount },
  ];
  return (
    <div>
      <SectionHeader title="On Cinelog" />
      {/* A shelf ledger: label left, count typed right, leader between. */}
      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-2">
            <dt className="text-muted">{r.label}</dt>
            <span
              aria-hidden="true"
              className="min-w-4 flex-1 border-b border-dotted border-border"
            />
            <dd className="font-data text-[13px] font-bold text-content">{r.value}</dd>
          </div>
        ))}
        {media.providerRating !== null && (
          <div className="flex items-baseline gap-2 border-t border-border pt-1.5">
            <dt className="text-muted">TMDB score</dt>
            <span
              aria-hidden="true"
              className="min-w-4 flex-1 border-b border-dotted border-border"
            />
            <dd className="font-data text-[13px] font-bold text-content">
              {(media.providerRating / 10).toFixed(1)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function CastGrid({
  people,
  emptyLabel,
  canEdit,
  onEdit,
}: {
  people: MediaDetail['cast'];
  emptyLabel: string;
  canEdit?: boolean;
  onEdit?: () => void;
}): JSX.Element {
  if (people.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-2">{emptyLabel}</p>
        {canEdit && onEdit && (
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Edit cast
          </Button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {people.slice(0, 12).map((c) => (
          <Link
            key={c.id}
            to={personPath(c)}
            className="group flex items-center gap-2.5"
            title={`Everything by ${c.name}`}
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-surface-2 ring-1 ring-border-hi/60 group-hover:ring-gold">
              {c.profileUrl && (
                <img
                  src={c.profileUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-content group-hover:text-gold">
                {c.name}
              </p>
              {(c.character || c.role) && (
                <p className="truncate text-xs text-muted-2">{c.character ?? c.role}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {canEdit && onEdit && (
        <Button size="sm" variant="secondary" className="mt-4" onClick={onEdit}>
          Edit cast
        </Button>
      )}
    </div>
  );
}

/** Machine values in the details list are typewritten; names and titles aren't. */
const DATA_ROWS = new Set(['Released', 'Runtime']);

function DetailsList({ media }: { media: MediaDetail }): JSX.Element {
  const rows: { label: string; value: string }[] = [];
  if (media.originalTitle && media.originalTitle !== media.title) {
    rows.push({ label: 'Original title', value: media.originalTitle });
  }
  if (media.releaseDate) rows.push({ label: 'Released', value: formatDate(media.releaseDate) });
  if (media.runtime) rows.push({ label: 'Runtime', value: formatRuntime(media.runtime) });
  if (media.studios.length) rows.push({ label: 'Studios', value: media.studios.join(', ') });
  rows.push({ label: 'Type', value: TYPE_LABEL[media.type] });

  return (
    <dl className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
          <dt className="font-cond text-[13px] font-bold uppercase tracking-[0.1em] text-muted-2">
            {r.label}
          </dt>
          <dd className={cn('text-content/90', DATA_ROWS.has(r.label) && 'font-data text-[13px]')}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Genres, each a door to that shelf of the catalogue. */
function GenreChips({ media }: { media: MediaDetail }): JSX.Element {
  if (media.genres.length === 0) return <p className="text-sm text-muted-2">No genres recorded.</p>;
  const type = isEpisodicType(media.type) ? '&type=TV' : '';
  return (
    <div className="flex flex-wrap gap-2">
      {media.genres.map((g) => (
        <Link
          key={g.id}
          to={`/films?genre=${encodeURIComponent(g.name)}${type}`}
          className="hover:[&>*]:border-content hover:[&>*]:text-content"
        >
          <Tag>{g.name}</Tag>
        </Link>
      ))}
    </div>
  );
}

/** Public lists this title sits in — rendered only when there are some. */
function ListsContaining({ mediaId }: { mediaId: string }): JSX.Element | null {
  const query = useInfiniteQuery({
    queryKey: ['media-lists', mediaId],
    staleTime: 10 * 60_000,
    queryFn: ({ pageParam }) => api.getMediaLists(mediaId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const lists = query.data?.pages.flatMap((p) => p.lists) ?? [];
  if (lists.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Lists containing this" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l) => (
          <ListCard key={l.id} list={l} />
        ))}
      </div>
      <LoadMore query={query} label="All lists" />
    </section>
  );
}

function SimilarSection({
  mediaId,
  isEpisodic,
}: {
  mediaId: string;
  isEpisodic: boolean;
}): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['similar', mediaId],
    queryFn: () => api.getSimilar(mediaId),
    staleTime: 1000 * 60 * 30,
  });

  // Rendered only when the provider actually returned neighbours — an empty
  // "Similar films" heading would just be dead weight.
  if (!data || data.results.length === 0) return null;

  return (
    <section>
      <SectionHeader title={isEpisodic ? 'Similar shows' : 'Similar films'} />
      <PosterGrid variant="dense">
        {data.results.map((r) => (
          <Poster
            key={`${r.provider}:${r.externalId}`}
            title={r.title}
            year={r.year}
            type={r.type}
            posterUrl={r.posterUrl}
            to={mediaHref(r)}
          />
        ))}
      </PosterGrid>
    </section>
  );
}

/**
 * Where a credited name leads. Credits cached before person ids were recorded
 * carry only a name, so those route through the by-name lookup instead of being
 * left as dead text — the same page either way.
 */
function personPath(c: CreditPerson): string {
  return c.personId
    ? `/person/${encodeURIComponent(c.personId)}`
    : `/person/name/${encodeURIComponent(c.name)}`;
}
