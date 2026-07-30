import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MediaType, ProviderId } from '@cinelog/contracts';
import {
  METADATA_PROVIDERS,
  type DiscoverListKind,
  type MetadataProvider,
  type ProviderBrowseParams,
  type ProviderBrowseResult,
  type ProviderMediaDetails,
  type ProviderPerson,
  type ProviderSearchResult,
  type ProviderWatchProviders,
} from './provider.types';

/**
 * Resolves and orchestrates metadata providers. All provider access in the app
 * goes through here, so adding TVDB/AniList later means registering a class —
 * no call sites change.
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);

  /** Preferred provider order per media type (first available wins). */
  private readonly preference: Partial<Record<MediaType, ProviderId[]>> = {
    ANIME: ['anilist', 'tvdb', 'tmdb'],
    TV: ['tvdb', 'tmdb'],
    MINISERIES: ['tvdb', 'tmdb'],
  };

  constructor(
    @Inject(METADATA_PROVIDERS) private readonly providers: MetadataProvider[],
  ) {}

  getById(id: ProviderId): MetadataProvider {
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) throw new NotFoundException(`Metadata provider '${id}' is not available`);
    return provider;
  }

  /** Pick the best available provider for a media type, honoring preferences. */
  getForType(type: MediaType): MetadataProvider {
    const order = this.preference[type] ?? ['tmdb'];
    for (const id of order) {
      const provider = this.providers.find((p) => p.id === id && p.supports(type));
      if (provider) return provider;
    }
    const fallback = this.providers.find((p) => p.supports(type));
    if (!fallback) throw new NotFoundException(`No provider supports media type '${type}'`);
    return fallback;
  }

  /** Search every provider that can serve the (optional) type, merging results.
   *  A single provider failing does not fail the whole search. */
  async search(query: string, type?: MediaType): Promise<ProviderSearchResult[]> {
    const candidates = this.providers.filter((p) => (type ? p.supports(type) : true));
    const settled = await Promise.allSettled(
      candidates.map((p) => p.search(query, type)),
    );
    const results: ProviderSearchResult[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') results.push(...r.value);
      else this.logger.warn(`Provider '${candidates[i]?.id}' search failed: ${r.reason}`);
    });
    return results;
  }

  getDetails(
    provider: ProviderId,
    externalId: string,
    type: MediaType,
  ): Promise<ProviderMediaDetails> {
    return this.getById(provider).getDetails(externalId, type);
  }

  /** Trending/popular/upcoming rails for Discover. Returns [] rather than
   *  throwing when unsupported or unavailable (e.g. TMDB not configured) — the
   *  caller drops empty sections rather than breaking the whole page. */
  async getDiscoverList(kind: DiscoverListKind, type: MediaType): Promise<ProviderSearchResult[]> {
    const provider = this.getForType(type);
    if (!provider.getDiscoverList) return [];
    try {
      return await provider.getDiscoverList(kind, type);
    } catch (err) {
      this.logger.warn(`Provider '${provider.id}' discover(${kind}, ${type}) failed: ${err}`);
      return [];
    }
  }

  /** Similar titles for a film/show page. Absent or failing providers yield an
   *  empty list so the section is simply omitted rather than breaking the page. */
  /** Streaming availability, or null when the provider can't say. */
  async getWatchProviders(
    provider: string,
    externalId: string,
    region: string,
  ): Promise<ProviderWatchProviders | null> {
    const impl = this.providers.find((p) => p.id === provider);
    if (!impl?.getWatchProviders) return null;
    try {
      return await impl.getWatchProviders(externalId, region);
    } catch (err) {
      this.logger.warn(`Provider '${provider}' getWatchProviders failed: ${err}`);
      return null;
    }
  }

  async getSimilar(
    provider: ProviderId,
    externalId: string,
    type: MediaType,
  ): Promise<ProviderSearchResult[]> {
    const impl = this.providers.find((p) => p.id === provider);
    if (!impl?.getSimilar) return [];
    try {
      return await impl.getSimilar(externalId, type);
    } catch (err) {
      this.logger.warn(`Provider '${provider}' getSimilar failed: ${err}`);
      return [];
    }
  }

  /**
   * A person's filmography. Person pages are only ever reached from a credit,
   * and credits carry the provider that supplied them, so the lookup is scoped
   * to that provider rather than fanned out.
   */
  async getPerson(provider: ProviderId, personId: string): Promise<ProviderPerson> {
    const impl = this.getById(provider);
    if (!impl.getPerson) {
      throw new NotFoundException(`Provider '${provider}' does not serve people`);
    }
    return impl.getPerson(personId);
  }

  /** Resolve a name to a person id, for credits cached without one. */
  async findPerson(provider: ProviderId, name: string): Promise<string | null> {
    const impl = this.providers.find((p) => p.id === provider);
    if (!impl?.findPerson) return null;
    try {
      return await impl.findPerson(name);
    } catch (err) {
      this.logger.warn(`Provider '${provider}' findPerson failed: ${err}`);
      return null;
    }
  }

  /** Faceted catalog browse for the Films page. Like getDiscoverList, an
   *  unsupported or unavailable provider yields an empty page rather than a
   *  failed request, so the surrounding page still renders. */
  async browse(params: ProviderBrowseParams): Promise<ProviderBrowseResult> {
    const provider = this.getForType(params.type);
    if (!provider.browse) return { results: [], hasMore: false };
    try {
      return await provider.browse(params);
    } catch (err) {
      this.logger.warn(`Provider '${provider.id}' browse failed: ${err}`);
      return { results: [], hasMore: false };
    }
  }
}
