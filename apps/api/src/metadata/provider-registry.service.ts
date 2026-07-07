import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MediaType, ProviderId } from '@cinelog/contracts';
import {
  METADATA_PROVIDERS,
  type MetadataProvider,
  type ProviderMediaDetails,
  type ProviderSearchResult,
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
}
