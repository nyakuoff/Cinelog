import { Injectable } from '@nestjs/common';
import { Prisma, type MediaItem } from '@prisma/client';
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

/** Only the columns toSearchResult reads — keeps rawMetadata out of the query. */
const searchSelect = {
  id: true, provider: true, externalId: true, type: true, title: true,
  originalTitle: true, releaseDate: true, overview: true, posterPath: true,
} as const;
type SearchRow = Pick<MediaItem, keyof typeof searchSelect>;

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
    const defs = [
      ['TRENDING_MOVIES', 'Trending movies', 'TRENDING', 'MOVIE'],
      ['TRENDING_SHOWS', 'Trending shows', 'TRENDING', 'TV'],
      ['POPULAR', 'Popular this week', 'POPULAR', 'MOVIE'],
      ['NEW_AND_UPCOMING', 'New & upcoming', 'UPCOMING', 'MOVIE'],
    ] as const;
    const [lists, highlyRated] = await Promise.all([
      Promise.all(defs.map(([, , kind, type]) => this.registry.getDiscoverList(kind, type))),
      this.highlyRatedSection(),
    ]);
    const rails = lists.map((l) => l.slice(0, RAIL_SIZE));

    // One local lookup for every rail's titles instead of one per rail.
    const keys = rails.flat().map((r) => ({ provider: r.provider, externalId: r.externalId }));
    const existing = keys.length
      ? await this.prisma.mediaItem.findMany({
          where: { OR: keys },
          select: { id: true, provider: true, externalId: true },
        })
      : [];
    const idByKey = new Map(existing.map((e) => [`${e.provider}:${e.externalId}`, e.id]));
    const providerSections = defs.map(([key, title], i): DiscoverSection => ({
      key,
      title,
      source: 'PROVIDER',
      items: rails[i]!.map((r) => ({
        ...this.providerToSearchResult(r),
        id: idByKey.get(`${r.provider}:${r.externalId}`) ?? null,
      })),
    }));

    // Empty sections (provider not configured, or not enough community data yet)
    // are dropped rather than shown as dead/empty rails.
    const sections = [...providerSections, highlyRated].filter(
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

  /** Browse the local catalogue. Community rating/count are aggregated in
   *  SQL so minRating and the rating sorts see every matching title, then the
   *  page is cut — sorting/filtering an over-fetched window in memory only
   *  ever ranked the most recently cached few dozen. */
  async filter(query: DiscoverFilterQuery): Promise<DiscoverFilterResponse> {
    const take = query.limit;
    const skip = query.cursor ? Number(query.cursor) : 0;

    const conds: Prisma.Sql[] = [Prisma.sql`1 = 1`];
    if (query.type) conds.push(Prisma.sql`m."type" = ${query.type}`);
    if (query.genre) {
      // Implicit m:n table: A = genres.id, B = media_items.id.
      conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "_MediaGenres" mg JOIN "genres" g ON g."id" = mg."A"
        WHERE mg."B" = m."id" AND g."name" = ${query.genre})`);
    }
    if (query.decade) {
      conds.push(Prisma.sql`m."releaseDate" >= ${`${query.decade}-01-01`}
        AND m."releaseDate" < ${`${query.decade + 10}-01-01`}`);
    }
    const having =
      query.minRating !== undefined
        ? Prisma.sql`HAVING COALESCE(AVG(r."value"), 0) >= ${query.minRating}`
        : Prisma.empty;
    const orderBy = {
      POPULARITY: Prisma.sql`m."cachedAt" DESC`,
      RELEASE_DATE: Prisma.sql`m."releaseDate" DESC`,
      CINELOG_RATING: Prisma.sql`"avg" IS NULL, "avg" DESC`,
      RATING_COUNT: Prisma.sql`"cnt" DESC`,
      RECENTLY_REVIEWED: Prisma.sql`"lastReviewed" IS NULL, "lastReviewed" DESC`,
    }[query.sort];

    // take + 1 tells us whether another page exists without a COUNT query.
    const rows = await this.prisma.$queryRaw<{ id: string; avg: number | null; cnt: bigint | number }[]>`
      SELECT m."id" AS "id", AVG(r."value") AS "avg", COUNT(r."id") AS "cnt",
        (SELECT MAX(rv."createdAt") FROM "reviews" rv WHERE rv."mediaItemId" = m."id") AS "lastReviewed"
      FROM "media_items" m
      LEFT JOIN "ratings" r ON r."mediaItemId" = m."id"
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY m."id"
      ${having}
      ORDER BY ${orderBy}, m."id"
      LIMIT ${take + 1} OFFSET ${skip}`;

    const page = rows.slice(0, take);
    const media = page.length
      ? await this.prisma.mediaItem.findMany({ where: { id: { in: page.map((r) => r.id) } }, select: searchSelect })
      : [];
    const byId = new Map(media.map((m) => [m.id, m]));

    return {
      items: page.flatMap((r) => {
        const item = byId.get(r.id);
        return item
          ? [{ ...this.toSearchResult(item), communityRating: r.avg ?? null, ratingCount: Number(r.cnt) }]
          : [];
      }),
      nextCursor: rows.length > take ? String(skip + take) : null,
    };
  }

  // -- sections ----------------------------------------------------------------

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
    const media = await this.prisma.mediaItem.findMany({ where: { id: { in: ids } }, select: searchSelect });
    const byId = new Map(media.map((m) => [m.id, m]));
    return ids.map((id) => byId.get(id)).filter((m): m is SearchRow => !!m).map((m) => this.toSearchResult(m));
  }

  private toSearchResult(m: SearchRow): SearchResult {
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
