import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaType, ProviderId } from '@cinelog/contracts';
import type { AppConfig } from '../config/configuration';
import type {
  MetadataProvider,
  ProviderArtwork,
  ProviderBrowseParams,
  ProviderBrowseResult,
  ProviderCredit,
  ProviderEpisode,
  ProviderMediaDetails,
  ProviderSearchResult,
  ProviderSeason,
} from './provider.types';

/** TMDB genre ids are stable published constants, so they're mapped inline
 *  rather than fetched on every browse request. Movie and TV use different
 *  ids for the same human-facing genre name; both are listed where they differ. */
const TMDB_GENRE_IDS: Record<string, { movie?: number; tv?: number }> = {
  Action: { movie: 28, tv: 10759 },
  Adventure: { movie: 12, tv: 10759 },
  Animation: { movie: 16, tv: 16 },
  Comedy: { movie: 35, tv: 35 },
  Crime: { movie: 80, tv: 80 },
  Documentary: { movie: 99, tv: 99 },
  Drama: { movie: 18, tv: 18 },
  Family: { movie: 10751, tv: 10751 },
  Fantasy: { movie: 14, tv: 10765 },
  History: { movie: 36 },
  Horror: { movie: 27 },
  Music: { movie: 10402 },
  Mystery: { movie: 9648, tv: 9648 },
  Romance: { movie: 10749 },
  'Science Fiction': { movie: 878, tv: 10765 },
  Thriller: { movie: 53 },
  War: { movie: 10752, tv: 10768 },
  Western: { movie: 37, tv: 37 },
};

const API_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

/** TMDB shares numeric ids between movies and shows, so we namespace the
 *  externalId as `movie:123` / `tv:123`. */
type TmdbKind = 'movie' | 'tv';

function encodeExternalId(kind: TmdbKind, id: number): string {
  return `${kind}:${id}`;
}
function decodeExternalId(externalId: string): { kind: TmdbKind; id: string } {
  const [kind, id] = externalId.split(':');
  return { kind: (kind === 'tv' ? 'tv' : 'movie') as TmdbKind, id: id ?? externalId };
}

function img(path: string | null | undefined, size: string): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

@Injectable()
export class TmdbProvider implements MetadataProvider {
  readonly id: ProviderId = 'tmdb';
  private readonly logger = new Logger(TmdbProvider.name);

  constructor(private readonly config: ConfigService) {}

  supports(type: MediaType): boolean {
    // TMDB reasonably covers everything except (accurately) anime, which will be
    // routed to AniList once that provider lands. For now it is the fallback.
    return true;
  }

  async search(query: string, type?: MediaType): Promise<ProviderSearchResult[]> {
    const data = await this.request<TmdbSearchResponse>('/search/multi', {
      query,
      include_adult: 'false',
    });
    const results: ProviderSearchResult[] = [];
    for (const item of data.results ?? []) {
      if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
      const mapped = this.mapSearchItem(item);
      if (type && mapped.type !== type) continue;
      results.push(mapped);
    }
    return results;
  }

  async getDetails(externalId: string, _type: MediaType): Promise<ProviderMediaDetails> {
    const { kind, id } = decodeExternalId(externalId);
    const data = await this.request<TmdbDetails>(`/${kind}/${id}`, {
      append_to_response: 'credits,images,videos',
      include_image_language: 'en,null',
    });
    return this.mapDetails(kind, data);
  }

  async getDiscoverList(
    kind: 'TRENDING' | 'POPULAR' | 'UPCOMING',
    type: MediaType,
  ): Promise<ProviderSearchResult[]> {
    const tmdbKind: TmdbKind = type === 'TV' ? 'tv' : 'movie';
    const path =
      kind === 'TRENDING'
        ? `/trending/${tmdbKind}/week`
        : kind === 'POPULAR'
          ? `/${tmdbKind}/popular`
          : tmdbKind === 'movie'
            ? '/movie/upcoming'
            : '/tv/on_the_air';
    const data = await this.request<TmdbSearchResponse>(path, {});
    return (data.results ?? []).map((item) => this.mapSearchItem({ ...item, media_type: tmdbKind }));
  }

  /** Faceted catalog browse via TMDB's /discover endpoints — the Films page.
   *  Browsing the provider catalog (rather than only locally cached titles)
   *  is what keeps the grid populated on a fresh instance. */
  async browse(params: ProviderBrowseParams): Promise<ProviderBrowseResult> {
    const kind: TmdbKind = params.type === 'TV' ? 'tv' : 'movie';
    const dateField = kind === 'tv' ? 'first_air_date' : 'primary_release_date';
    const query: Record<string, string> = {
      page: String(params.page),
      include_adult: 'false',
      // Exclude the long tail of unrated/near-unknown entries, which otherwise
      // dominate every sort other than popularity.
      'vote_count.gte': params.sort === 'RATING' ? '200' : '20',
      sort_by: this.tmdbSortBy(params.sort, kind),
    };

    if (params.genre) {
      const id = TMDB_GENRE_IDS[params.genre]?.[kind];
      // An unsupported genre for this type would otherwise silently return the
      // unfiltered catalog, which reads as a broken filter.
      if (id === undefined) return { results: [], hasMore: false };
      query.with_genres = String(id);
    }
    if (params.year !== undefined) {
      query[`${dateField}.gte`] = `${params.year}-01-01`;
      query[`${dateField}.lte`] = `${params.year}-12-31`;
    } else if (params.decade !== undefined) {
      query[`${dateField}.gte`] = `${params.decade}-01-01`;
      query[`${dateField}.lte`] = `${params.decade + 9}-12-31`;
    }
    if (params.minRating !== undefined) {
      query['vote_average.gte'] = String(params.minRating / 10);
    }

    const data = await this.request<TmdbDiscoverResponse>(`/discover/${kind}`, query);
    const results = (data.results ?? []).map((item) =>
      this.mapSearchItem({ ...item, media_type: kind }),
    );
    const totalPages = data.total_pages ?? 1;
    return { results, hasMore: params.page < Math.min(totalPages, 500) };
  }

  private tmdbSortBy(sort: ProviderBrowseParams['sort'], kind: TmdbKind): string {
    const dateField = kind === 'tv' ? 'first_air_date' : 'primary_release_date';
    switch (sort) {
      case 'RATING':
        return 'vote_average.desc';
      case 'RELEASE_DATE':
        return `${dateField}.desc`;
      case 'TITLE':
        return kind === 'tv' ? 'name.asc' : 'title.asc';
      // CINELOG_RATING is re-sorted against local ratings by the caller; the
      // provider still needs a deterministic base ordering to page through.
      case 'CINELOG_RATING':
      case 'POPULARITY':
      default:
        return 'popularity.desc';
    }
  }

  async getSeasons(externalId: string): Promise<ProviderSeason[]> {
    const { kind, id } = decodeExternalId(externalId);
    if (kind !== 'tv') return [];
    const data = await this.request<TmdbDetails>(`/tv/${id}`, {});
    return (data.seasons ?? [])
      .filter((s) => (s.season_number ?? 0) >= 1) // skip "Specials" (season 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        name: s.name ?? null,
        overview: s.overview || null,
        posterUrl: img(s.poster_path, 'w342'),
        airDate: s.air_date ?? null,
        episodeCount: s.episode_count ?? 0,
      }));
  }

  async getEpisodes(externalId: string, seasonNumber: number): Promise<ProviderEpisode[]> {
    const { kind, id } = decodeExternalId(externalId);
    if (kind !== 'tv') return [];
    const data = await this.request<TmdbSeasonDetail>(`/tv/${id}/season/${seasonNumber}`, {});
    return (data.episodes ?? []).map((e) => ({
      episodeNumber: e.episode_number,
      name: e.name ?? null,
      overview: e.overview || null,
      stillUrl: img(e.still_path, 'w300'),
      airDate: e.air_date ?? null,
      runtime: e.runtime ?? null,
    }));
  }

  // -- mapping ---------------------------------------------------------------

  private mapSearchItem(item: TmdbSearchItem): ProviderSearchResult {
    const kind: TmdbKind = item.media_type === 'tv' ? 'tv' : 'movie';
    const title = item.title ?? item.name ?? 'Untitled';
    const date = item.release_date ?? item.first_air_date ?? null;
    return {
      provider: 'tmdb',
      externalId: encodeExternalId(kind, item.id),
      type: kind === 'tv' ? 'TV' : 'MOVIE',
      title,
      originalTitle: item.original_title ?? item.original_name ?? null,
      year: date ? Number(date.slice(0, 4)) || null : null,
      overview: item.overview || null,
      posterUrl: img(item.poster_path, 'w500'),
    };
  }

  private mapDetails(kind: TmdbKind, d: TmdbDetails): ProviderMediaDetails {
    const cast: ProviderCredit[] = (d.credits?.cast ?? []).slice(0, 24).map((c) => ({
      name: c.name,
      role: null,
      character: c.character ?? null,
      department: 'Acting',
      profileUrl: img(c.profile_path, 'w185'),
    }));
    const crew: ProviderCredit[] = (d.credits?.crew ?? [])
      .filter((c) => ['Director', 'Writer', 'Screenplay', 'Producer', 'Creator'].includes(c.job ?? ''))
      .slice(0, 12)
      .map((c) => ({
        name: c.name,
        role: c.job ?? null,
        character: null,
        department: c.department ?? null,
        profileUrl: img(c.profile_path, 'w185'),
      }));

    const artwork: ProviderArtwork[] = [
      ...(d.images?.posters ?? []).map((i) => this.mapArtwork('POSTER', i)),
      ...(d.images?.backdrops ?? []).map((i) => this.mapArtwork('BACKDROP', i)),
      ...(d.images?.logos ?? []).map((i) => this.mapArtwork('LOGO', i)),
    ];

    const trailer = (d.videos?.results ?? []).find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer',
    );

    return {
      provider: 'tmdb',
      externalId: encodeExternalId(kind, d.id),
      type: kind === 'tv' ? 'TV' : 'MOVIE',
      title: d.title ?? d.name ?? 'Untitled',
      originalTitle: d.original_title ?? d.original_name ?? null,
      releaseDate: d.release_date ?? d.first_air_date ?? null,
      runtime: d.runtime ?? d.episode_run_time?.[0] ?? null,
      overview: d.overview || null,
      tagline: d.tagline || null,
      posterUrl: img(d.poster_path, 'w500'),
      backdropUrl: img(d.backdrop_path, 'w1280'),
      logoUrl: img(d.images?.logos?.[0]?.file_path, 'w500'),
      genres: (d.genres ?? []).map((g) => g.name),
      studios: (d.production_companies ?? []).map((c) => c.name),
      cast,
      crew,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      providerRating: typeof d.vote_average === 'number' ? d.vote_average * 10 : null,
      artwork,
    };
  }

  private mapArtwork(type: ProviderArtwork['type'], i: TmdbImage): ProviderArtwork {
    return {
      type,
      url: `${IMG_BASE}/original${i.file_path}`,
      width: i.width ?? null,
      height: i.height ?? null,
      language: i.iso_639_1 ?? null,
    };
  }

  // -- http ------------------------------------------------------------------

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const { apiKey, accessToken } = this.config.getOrThrow<AppConfig['tmdb']>('tmdb');
    if (!apiKey && !accessToken) {
      throw new ServiceUnavailableException(
        'TMDB is not configured. Set TMDB_API_KEY or TMDB_ACCESS_TOKEN.',
      );
    }

    const url = new URL(API_BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    else url.searchParams.set('api_key', apiKey);

    const res = await fetch(url, { headers });
    if (!res.ok) {
      this.logger.warn(`TMDB ${path} -> ${res.status}`);
      throw new ServiceUnavailableException(`TMDB request failed (${res.status})`);
    }
    return (await res.json()) as T;
  }
}

// -- minimal TMDB response shapes (only the fields we read) ------------------

interface TmdbSearchItem {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
}
interface TmdbSearchResponse {
  results?: TmdbSearchItem[];
}
interface TmdbDiscoverResponse {
  results?: TmdbSearchItem[];
  total_pages?: number;
}
interface TmdbImage {
  file_path: string;
  width?: number;
  height?: number;
  iso_639_1?: string | null;
}
interface TmdbDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  tagline?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  genres?: { id: number; name: string }[];
  production_companies?: { id: number; name: string }[];
  credits?: {
    cast?: { name: string; character?: string; profile_path?: string | null }[];
    crew?: {
      name: string;
      job?: string;
      department?: string;
      profile_path?: string | null;
    }[];
  };
  images?: { posters?: TmdbImage[]; backdrops?: TmdbImage[]; logos?: TmdbImage[] };
  videos?: { results?: { site: string; type: string; key: string }[] };
  seasons?: TmdbSeason[];
}
interface TmdbSeason {
  season_number: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string;
  episode_count?: number;
}
interface TmdbSeasonDetail {
  episodes?: {
    episode_number: number;
    name?: string;
    overview?: string;
    still_path?: string | null;
    air_date?: string;
    runtime?: number | null;
  }[];
}
