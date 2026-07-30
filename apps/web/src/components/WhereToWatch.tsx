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
  // Nothing to request once a title is already there — no button, and no row
  // restating what the Jellyfin link above it already says.
  const showRequest = data.requestSupported && data.requestStatus !== 'AVAILABLE';
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
      className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-[#101820] ring-1 ring-border-hi/60"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="jf-mark" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#AA5CC3" />
            <stop offset="1" stopColor="#00A4DC" />
          </linearGradient>
        </defs>
        {/* Two nested rounded triangles — the stacked sheets of the Jellyfin
            mark, the lower one carrying the gradient at full strength. */}
        <path
          fill="url(#jf-mark)"
          d="M12 9.4c1 0 6.6 10.2 6.1 11.3-.5 1-11.7 1-12.2 0C5.4 19.6 11 9.4 12 9.4Z"
        />
        <path
          fill="url(#jf-mark)"
          opacity="0.62"
          d="M12 2c.8 0 5.3 8.1 4.9 9-.4.8-9.4.8-9.8 0C6.7 10.1 11.2 2 12 2Z"
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
