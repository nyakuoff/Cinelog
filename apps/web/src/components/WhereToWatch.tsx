import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaDetail, RequestStatus, WatchProvider } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';

/**
 * "Where to watch", under the poster.
 *
 * Everything here is assembled server-side (see AvailabilityService), because
 * the Jellyfin and Jellyseerr lookups need API keys the browser must never
 * hold. Each source degrades on its own, so a sleeping homelab server costs
 * this box a row rather than breaking the page.
 *
 * The box is absent entirely when there's nothing to show — no dead controls
 * and no empty heading.
 */
export function WhereToWatch({ media }: { media: MediaDetail }): JSX.Element | null {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['availability', media.id],
    queryFn: () => api.getAvailability(media.id),
    // Availability changes on the timescale of licensing deals and library
    // scans, not page views.
    staleTime: 1000 * 60 * 10,
  });

  const requestMut = useMutation({
    mutationFn: () => api.requestMedia(media.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['availability', media.id] }),
  });

  if (isLoading || !data) return null;

  const hasStreaming = data.streaming.length > 0 || data.rent.length > 0 || data.buy.length > 0;
  // A playable copy settles the question. Once there's a Jellyfin link, no
  // request row belongs under it — not a button, and not a status restating in
  // worse words what the link above already proves.
  const showRequest =
    data.requestSupported && !data.jellyfinUrl && data.requestStatus !== 'AVAILABLE';
  if (!data.jellyfinUrl && !hasStreaming && !showRequest) return null;

  return (
    <div className="rounded-sm border border-border-hi bg-surface">
      <p className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-1.5 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
        Where to watch
        {data.region && <span className="font-data tracking-normal">{data.region}</span>}
      </p>

      <div className="divide-y divide-border">
        {/* The instance's own copy comes first — it's the one you can play now.
            Same grammar as the paid tiers below it: the source named on the
            left, its mark in the logo lane, so the box reads as one list. */}
        {data.jellyfinUrl && (
          <a
            href={data.jellyfinUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-start gap-2 px-3 py-2.5 hover:bg-surface-2"
          >
            <span className="w-[62px] shrink-0 pt-1 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-cyan">
              Jellyfin
            </span>
            <JellyfinMark />
          </a>
        )}

        {data.streaming.length > 0 && (
          <ProviderRow label="Stream" providers={data.streaming} link={data.providerLink} />
        )}
        {data.rent.length > 0 && (
          <ProviderRow label="Rent" providers={data.rent} link={data.providerLink} />
        )}
        {data.buy.length > 0 && (
          <ProviderRow label="Buy" providers={data.buy} link={data.providerLink} />
        )}

        {showRequest && (
          <div className="px-3 py-2.5">
            <RequestControl
              status={data.requestStatus}
              pending={requestMut.isPending}
              error={requestMut.error}
              onRequest={() => requestMut.mutate()}
            />
          </div>
        )}
      </div>

      {hasStreaming && (
        <p className="border-t border-border px-3 py-1.5 font-data text-[11px] text-muted-2">
          via JustWatch
        </p>
      )}
    </div>
  );
}

/**
 * Jellyfin's mark, in the same 28px square the streaming services get.
 *
 * Drawn inline rather than fetched: a self-hosted instance may have no outbound
 * internet, and the one row that is definitely about this server should not be
 * the row that fails to load its image.
 */
function JellyfinMark(): JSX.Element {
  return (
    <span
      title="Jellyfin"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-[#1b2733] ring-1 ring-border-hi/60"
    >
      <svg width="19" height="19" viewBox="0 0 512 512" aria-hidden="true">
        <linearGradient
          id="jf-inner"
          x1="97.508"
          x2="522.069"
          y1="308.135"
          y2="63.019"
          gradientTransform="matrix(1 0 0 -1 0 514)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#aa5cc3" />
          <stop offset="1" stopColor="#00a4dc" />
        </linearGradient>
        <path
          fill="url(#jf-inner)"
          d="M256 196.2c-22.4 0-94.8 131.3-83.8 153.4s156.8 21.9 167.7 0-61.3-153.4-83.9-153.4"
        />
        <linearGradient
          id="jf-outer"
          x1="94.193"
          x2="518.754"
          y1="302.394"
          y2="57.278"
          gradientTransform="matrix(1 0 0 -1 0 514)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#aa5cc3" />
          <stop offset="1" stopColor="#00a4dc" />
        </linearGradient>
        <path
          fill="url(#jf-outer)"
          d="M256 0C188.3 0-29.8 395.4 3.4 462.2s472.3 66 505.2 0S323.8 0 256 0m165.6 404.3c-21.6 43.2-309.3 43.8-331.1 0S211.7 101.4 256 101.4 443.2 361 421.6 404.3"
        />
      </svg>
    </span>
  );
}

/** A payment tier and the services offering it, shown by their own logos. */
function ProviderRow({
  label,
  providers,
  link,
}: {
  label: string;
  providers: WatchProvider[];
  link: string | null;
}): JSX.Element {
  const body = (
    <>
      <span className="w-[62px] shrink-0 pt-1 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
        {label}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {providers.map((p) =>
          p.logoUrl ? (
            <img
              key={p.name}
              src={p.logoUrl}
              alt={p.name}
              title={p.name}
              loading="lazy"
              className="h-7 w-7 rounded-sm ring-1 ring-border-hi/60"
            />
          ) : (
            <span
              key={p.name}
              title={p.name}
              className="grid h-7 place-items-center rounded-sm bg-surface-2 px-1.5 font-cond text-[11px] font-bold uppercase text-muted"
            >
              {p.name.slice(0, 3)}
            </span>
          ),
        )}
      </span>
    </>
  );

  return link ? (
    <a
      href={link}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-start gap-2 px-3 py-2.5 hover:bg-surface-2"
    >
      {body}
    </a>
  ) : (
    <div className="flex items-start gap-2 px-3 py-2.5">{body}</div>
  );
}

/**
 * Requesting through Jellyseerr. When a request already exists this reports its
 * stage instead of offering a second one — the whole point of checking status
 * first is not to queue the same title twice.
 */
function RequestControl({
  status,
  pending,
  error,
  onRequest,
}: {
  status: RequestStatus;
  pending: boolean;
  error: unknown;
  onRequest: () => void;
}): JSX.Element {
  // Both in-flight stages read simply as "Requested". Which queue a title sits
  // in is Jellyseerr's business, not something to report on a film page.
  const already: Partial<Record<RequestStatus, { label: string; tone: string }>> = {
    PENDING: { label: 'Requested', tone: 'text-gold' },
    PROCESSING: { label: 'Requested', tone: 'text-gold' },
    PARTIALLY_AVAILABLE: { label: 'Partly available', tone: 'text-cyan' },
  };
  const existing = already[status];

  if (existing) {
    return (
      <p
        className={cn(
          'font-cond text-[13px] font-bold uppercase tracking-[0.08em]',
          existing.tone,
        )}
      >
        {existing.label}
      </p>
    );
  }

  return (
    <>
      <button
        onClick={onRequest}
        disabled={pending}
        className="w-full rounded-sm border border-border-hi bg-transparent px-3 py-1.5 font-cond text-[13px] font-bold uppercase tracking-[0.08em] text-content hover:border-gold hover:text-gold disabled:opacity-50"
      >
        {pending ? 'Requesting…' : 'Request'}
      </button>
      {error != null && (
        <p className="mt-1.5 text-xs text-rose">
          {error instanceof ApiError ? error.message : 'Could not send that request'}
        </p>
      )}
    </>
  );
}
