import { useQuery } from '@tanstack/react-query';
import type { MediaDetail } from '@cinelog/contracts';
import { api } from '../lib/api';

/**
 * "Where to watch", under the poster.
 *
 * These are deep links into services the instance's admin configured — nothing
 * is proxied and no API key is involved, so Cinelog can't actually know whether
 * a title is on the Jellyfin server. The Jellyfin link is therefore a search,
 * labelled as one, rather than a claim that the title is there. The request
 * link goes straight to the title's page in Jellyseerr/Overseerr, which do key
 * their routes on TMDB ids.
 *
 * The whole box is absent when the admin has configured nothing, rather than
 * showing dead controls.
 */
export function WhereToWatch({ media }: { media: MediaDetail }): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations(),
    // Instance config changes rarely; don't refetch it per media page.
    staleTime: 1000 * 60 * 30,
  });

  const jellyfin = data?.jellyfinUrl ?? null;
  const seerr = data?.seerrUrl ?? null;
  if (!jellyfin && !seerr) return null;

  // Jellyseerr/Overseerr route on the bare TMDB numeric id.
  const tmdbId =
    media.provider === 'tmdb' ? media.externalId.replace(/^(movie|tv):/, '') : null;
  const seerrKind = media.type === 'MOVIE' || media.type === 'SPECIAL' ? 'movie' : 'tv';

  return (
    <div className="rounded-sm border border-border-hi bg-surface">
      <p className="border-b border-border px-3 py-1.5 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-2">
        Where to watch
      </p>
      <div className="divide-y divide-border">
        {jellyfin && (
          <a
            href={`${jellyfin}/web/#/search.html?query=${encodeURIComponent(media.title)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-content hover:bg-surface-2"
          >
            <span className="font-cond font-bold uppercase tracking-[0.08em]">Jellyfin</span>
            <span className="font-data text-[11px] text-muted-2">search →</span>
          </a>
        )}
        {seerr && tmdbId && (
          <a
            href={`${seerr}/${seerrKind}/${tmdbId}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-content hover:bg-surface-2"
          >
            <span className="font-cond font-bold uppercase tracking-[0.08em]">Request</span>
            <span className="font-data text-[11px] text-muted-2">jellyseerr →</span>
          </a>
        )}
      </div>
    </div>
  );
}
