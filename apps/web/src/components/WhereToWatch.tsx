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
  const showRequest = data.requestSupported && data.requestStatus !== 'AVAILABLE';
  if (!data.jellyfinUrl && !hasStreaming && !showRequest) return null;

  return (
    <div className="rounded-sm border border-border-hi bg-surface">
      <p className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-1.5 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
        Where to watch
        {data.region && <span className="font-data tracking-normal">{data.region}</span>}
      </p>

      <div className="divide-y divide-border">
        {/* The instance's own copy comes first — it's the one you can play now. */}
        {data.jellyfinUrl && (
          <a
            href={data.jellyfinUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-2"
          >
            <span className="font-cond text-[13px] font-bold uppercase tracking-[0.08em] text-cyan">
              On Jellyfin
            </span>
            <span className="font-data text-[11px] text-muted-2">play →</span>
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
      <span className="w-11 shrink-0 pt-1 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
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
  const already: Partial<Record<RequestStatus, { label: string; tone: string }>> = {
    PENDING: { label: 'Requested · awaiting approval', tone: 'text-gold' },
    PROCESSING: { label: 'Requested · downloading', tone: 'text-cyan' },
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
