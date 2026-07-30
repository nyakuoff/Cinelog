import { Injectable } from '@nestjs/common';
import type { MediaItem } from '@prisma/client';
import {
  MediaType,
  type BrowseQuery,
  type BrowseResponse,
  type DiscoverFilterQuery,
  type DiscoverFilterResponse,
  type DiscoverResponse,
  type DiscoverSection,
  type SearchResult,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import type { ProviderSearchResult } from '../metadata/provider.types';

const RAIL_SIZE = 18;

/**
 * Titles per Films-browse page. The grid is 8-up at its widest, so a multiple
 * of 8 fills whole rows instead of leaving a ragged one; the provider pages at
 * 20, so a page here is assembled from more than one of theirs.
 */
const BROWSE_PAGE_SIZE = 24;
const PROVIDER_PAGE_SIZE = 20;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
    private readonly registry: ProviderRegistry,
  ) {}

  async getDiscover(): Promise<DiscoverResponse> {
    const [trendingMovies, trendingShows, popular, upcoming, highlyRated] =
      await Promise.all([
        this.providerSection('TRENDING_MOVIES', 'Trending movies', 'TRENDING', 'MOVIE'),
        this.providerSection('TRENDING_SHOWS', 'Trending shows', 'TRENDING', 'TV'),
        this.providerSection('POPULAR', 'Popular this week', 'POPULAR', 'MOVIE'),
        this.providerSection('NEW_AND_UPCOMING', 'New & upcoming', 'UPCOMING', 'MOVIE'),
        this.highlyRatedSection(),
      ]);

    // Empty sections (provider not configured, or not enough community data yet)
    // are dropped rather than shown as dead/empty rails.
    const sections = [trendingMovies, trendingShows, popular, upcoming, highlyRated].filter(
      (s): s is DiscoverSection => s.items.length > 0,
    );
    return { sections };
  }

  /** The Films browse page. Defaults to the provider catalog so the grid is
   *  populated on a fresh instance; `source=CINELOG` restricts to titles this
   *  instance's members have actually rated. Either way, community rating and
   *  rating count are attached from local data. */
  async browse(query: BrowseQuery): Promise<BrowseResponse> {
    if (query.source === 'CINELOG') {
      // TITLE has no local equivalent, so it falls back to popularity ordering.
      const localSort =
        query.sort === 'RELEASE_DATE'
          ? 'RELEASE_DATE'
          : query.sort === 'RATING' || query.sort === 'CINELOG_RATING'
            ? 'CINELOG_RATING'
            : 'POPULARITY';
      const page = await this.filter({
        type: query.type,
        genre: query.genre,
        decade: query.decade,
        minRating: query.minRating,
        sort: localSort,
        cursor: query.page > 1 ? String((query.page - 1) * BROWSE_PAGE_SIZE) : undefined,
        limit: BROWSE_PAGE_SIZE,
      });
      return {
        items: page.items,
        page: query.page,
        hasMore: page.nextCursor !== null,
        source: 'CINELOG',
      };
    }

    // A page of BROWSE_PAGE_SIZE spans provider pages of PROVIDER_PAGE_SIZE,
    // so gather the window that covers it and slice out the exact range.
    const from = (query.page - 1) * BROWSE_PAGE_SIZE;
    const firstProviderPage = Math.floor(from / PROVIDER_PAGE_SIZE) + 1;
    const lastProviderPage =
      Math.floor((from + BROWSE_PAGE_SIZE - 1) / PROVIDER_PAGE_SIZE) + 1;

    const pages = await Promise.all(
      Array.from({ length: lastProviderPage - firstProviderPage + 1 }, (_, i) =>
        this.registry.browse({
          type: query.type,
          genre: query.genre,
          decade: query.decade,
          year: query.year,
          minRating: query.minRating,
          sort: query.sort,
          page: firstProviderPage + i,
        }),
      ),
    );

    const offset = from - (firstProviderPage - 1) * PROVIDER_PAGE_SIZE;
    const gathered = pages.flatMap((p) => p.results);
    const results = gathered.slice(offset, offset + BROWSE_PAGE_SIZE);
    // More to show if the provider says so, or if this window didn't consume
    // everything already fetched.
    const hasMore =
      pages[pages.length - 1]?.hasMore === true ||
      gathered.length > offset + BROWSE_PAGE_SIZE;

    const keys = results.map((r) => ({ provider: r.provider, externalId: r.externalId }));
    const cached = keys.length
      ? await this.prisma.mediaItem.findMany({
          where: { OR: keys },
          select: { id: true, provider: true, externalId: true },
        })
      : [];
    const byKey = new Map(cached.map((c) => [`${c.provider}:${c.externalId}`, c.id]));

    // Community stats only exist for titles already cached locally; everything
    // else reports zero ratings rather than a fabricated score.
    const cachedIds = [...byKey.values()];
    const grouped = cachedIds.length
      ? await this.prisma.rating.groupBy({
          by: ['mediaItemId'],
          where: { mediaItemId: { in: cachedIds } },
          _avg: { value: true },
          _count: { value: true },
        })
      : [];
    const statsById = new Map(
      grouped.map((g) => [g.mediaItemId, { avg: g._avg.value, count: g._count.value }]),
    );

    const items = results.map((r) => {
      const id = byKey.get(`${r.provider}:${r.externalId}`) ?? null;
      const stats = id ? statsById.get(id) : undefined;
      return {
        ...this.providerToSearchResult(r),
        id,
        communityRating: stats?.avg ?? null,
        ratingCount: stats?.count ?? 0,
      };
    });

    if (query.sort === 'CINELOG_RATING') {
      items.sort((a, b) => (b.communityRating ?? -1) - (a.communityRating ?? -1));
    }

    return { items, page: query.page, hasMore, source: 'PROVIDER' };
  }

  async filter(query: DiscoverFilterQuery): Promise<DiscoverFilterResponse> {
    const take = query.limit;
    const skip = query.cursor ? Number(query.cursor) : 0;

    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type;
    if (query.genre) where.genres = { some: { name: query.genre } };
    if (query.decade) {
      where.releaseDate = { gte: `${query.decade}-01-01`, lt: `${query.decade + 10}-01-01` };
    }

    const items = await this.prisma.mediaItem.findMany({
      where,
      include: { ratings: true },
      // Approximate ordering in SQL; final precise ordering (by rating/rating
      // count, which need aggregation) is applied in memory below.
      orderBy: query.sort === 'RELEASE_DATE' ? { releaseDate: 'desc' } : { cachedAt: 'desc' },
      take: take * 3, // over-fetch since minRating/community sort are applied post-query
      skip,
    });

    let scored = items.map((item) => {
      const ratings = item.ratings.map((r) => r.value);
      const communityRating = ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;
      return { item, communityRating, ratingCount: ratings.length };
    });

    if (query.minRating !== undefined) {
      scored = scored.filter((s) => (s.communityRating ?? 0) >= query.minRating!);
    }
    if (query.sort === 'CINELOG_RATING') {
      scored.sort((a, b) => (b.communityRating ?? -1) - (a.communityRating ?? -1));
    } else if (query.sort === 'RATING_COUNT' || query.sort === 'RECENTLY_REVIEWED') {
      scored.sort((a, b) => b.ratingCount - a.ratingCount);
    }
    scored = scored.slice(0, take);

    return {
      items: scored.map((s) => ({
        ...this.toSearchResult(s.item),
        communityRating: s.communityRating,
        ratingCount: s.ratingCount,
      })),
      nextCursor: items.length >= take ? String(skip + take) : null,
    };
  }

  // -- sections ----------------------------------------------------------------

  private async providerSection(
    key: DiscoverSection['key'],
    title: string,
    kind: 'TRENDING' | 'POPULAR' | 'UPCOMING',
    type: MediaType,
  ): Promise<DiscoverSection> {
    const results = (await this.registry.getDiscoverList(kind, type)).slice(0, RAIL_SIZE);
    const keys = results.map((r) => ({ provider: r.provider, externalId: r.externalId }));
    const existing = keys.length
      ? await this.prisma.mediaItem.findMany({
          where: { OR: keys },
          select: { id: true, provider: true, externalId: true },
        })
      : [];
    const idByKey = new Map(existing.map((e) => [`${e.provider}:${e.externalId}`, e.id]));

    return {
      key,
      title,
      source: 'PROVIDER',
      items: results.map((r) => ({
        ...this.providerToSearchResult(r),
        id: idByKey.get(`${r.provider}:${r.externalId}`) ?? null,
      })),
    };
  }

  private async highlyRatedSection(): Promise<DiscoverSection> {
    const grouped = await this.prisma.rating.groupBy({
      by: ['mediaItemId'],
      _avg: { value: true },
      _count: { value: true },
      having: { value: { _count: { gte: 2 } } },
      orderBy: { _avg: { value: 'desc' } },
      take: RAIL_SIZE,
    });
    const items = await this.mediaForGroups(grouped.map((g) => g.mediaItemId));
    return { key: 'HIGHLY_RATED', title: 'Highly rated on Cinelog', source: 'CINELOG', items };
  }

  private async mediaForGroups(ids: string[]): Promise<SearchResult[]> {
    if (!ids.length) return [];
    const media = await this.prisma.mediaItem.findMany({ where: { id: { in: ids } } });
    const byId = new Map(media.map((m) => [m.id, m]));
    return ids.map((id) => byId.get(id)).filter((m): m is MediaItem => !!m).map((m) => this.toSearchResult(m));
  }

  private toSearchResult(m: MediaItem): SearchResult {
    return {
      id: m.id,
      provider: m.provider as SearchResult['provider'],
      externalId: m.externalId,
      type: MediaType.catch('MOVIE').parse(m.type),
      title: m.title,
      originalTitle: m.originalTitle,
      year: m.releaseDate ? Number(m.releaseDate.slice(0, 4)) || null : null,
      overview: m.overview,
      posterUrl: this.artwork.toProxyUrl(m.posterPath),
    };
  }

  private providerToSearchResult(r: ProviderSearchResult): SearchResult {
    return {
      id: null,
      provider: r.provider,
      externalId: r.externalId,
      type: r.type,
      title: r.title,
      originalTitle: r.originalTitle,
      year: r.year,
      overview: r.overview,
      posterUrl: this.artwork.toProxyUrl(r.posterUrl),
    };
  }
}
