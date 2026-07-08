import type { ArtworkType, MediaType, ProviderId } from '@cinelog/contracts';

/** A lightweight search hit, before it is cached as a MediaItem. */
export interface ProviderSearchResult {
  provider: ProviderId;
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle: string | null;
  year: number | null;
  overview: string | null;
  /** Absolute URL to the provider's poster CDN (proxied/cached on the way out). */
  posterUrl: string | null;
}

export interface ProviderCredit {
  name: string;
  role: string | null;
  character: string | null;
  department: string | null;
  profileUrl: string | null;
}

export interface ProviderArtwork {
  type: ArtworkType;
  url: string;
  width: number | null;
  height: number | null;
  language: string | null;
}

/** Full, normalized details from a provider. The media service maps this to the
 *  cached MediaItem + the MediaDetail contract. */
export interface ProviderMediaDetails {
  provider: ProviderId;
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  runtime: number | null;
  overview: string | null;
  tagline: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  genres: string[];
  studios: string[];
  cast: ProviderCredit[];
  crew: ProviderCredit[];
  trailerUrl: string | null;
  /** Provider's own average, normalized to 0..100, or null. */
  providerRating: number | null;
  artwork: ProviderArtwork[];
}

export interface ProviderSeason {
  seasonNumber: number;
  name: string | null;
  overview: string | null;
  posterUrl: string | null;
  airDate: string | null;
  episodeCount: number;
}

export interface ProviderEpisode {
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  stillUrl: string | null;
  airDate: string | null;
  runtime: number | null;
}

/**
 * The extensibility seam. A new metadata source is added by implementing this
 * interface and registering it — nothing else in the app touches provider APIs.
 */
export interface MetadataProvider {
  readonly id: ProviderId;
  /** Whether this provider can serve the given media type. */
  supports(type: MediaType): boolean;
  search(query: string, type?: MediaType): Promise<ProviderSearchResult[]>;
  getDetails(externalId: string, type: MediaType): Promise<ProviderMediaDetails>;
  /** Episodic providers implement these; movie-only ones may omit them. */
  getSeasons?(externalId: string): Promise<ProviderSeason[]>;
  getEpisodes?(externalId: string, seasonNumber: number): Promise<ProviderEpisode[]>;
}

/** DI token for the array of registered providers. */
export const METADATA_PROVIDERS = Symbol('METADATA_PROVIDERS');
