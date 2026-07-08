import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';

const SITE_NAME = 'Cinelog';
const SITE_DESCRIPTION =
  'Track every film, series, anime, and documentary you watch — rate, review, and build your library.';

/** Generates crawler-facing HTML with Open Graph / Twitter Card meta tags.
 *  Social scrapers don't run JS, so an SPA route needs server-rendered tags;
 *  nginx routes crawler user-agents here while humans get the app directly. */
@Injectable()
export class OgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
  ) {}

  /** OG document for a single media item. Falls back to the site card if the
   *  id is unknown, so stale links still embed as Cinelog rather than 404. */
  async mediaHtml(mediaId: string, baseUrl: string): Promise<string> {
    const item = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) return this.siteHtml(baseUrl);

    const year = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
    const title = year ? `${item.title} (${year})` : item.title;
    const description = truncate(item.tagline || item.overview || SITE_DESCRIPTION, 200);
    // Prefer the wide backdrop for a large summary card; fall back to poster.
    const image = this.absoluteArtwork(item.backdropPath ?? item.posterPath, baseUrl);
    const isFilm = item.type === 'MOVIE' || item.type === 'SPECIAL';

    return this.render({
      title: `${title} · ${SITE_NAME}`,
      description,
      canonical: `${baseUrl}/media/${item.id}`,
      image,
      ogType: isFilm ? 'video.movie' : 'video.tv_show',
      redirectTo: `${baseUrl}/media/${item.id}`,
    });
  }

  /** Generic site card for non-media pages or unknown ids. No bundled hero
   *  image ships yet, so this degrades to a clean text summary card. */
  siteHtml(baseUrl: string): string {
    return this.render({
      title: `${SITE_NAME} — your personal watch log`,
      description: SITE_DESCRIPTION,
      canonical: baseUrl,
      image: null,
      ogType: 'website',
      redirectTo: baseUrl,
    });
  }

  private absoluteArtwork(sourceUrl: string | null, baseUrl: string): string | null {
    const proxied = this.artwork.toProxyUrl(sourceUrl); // e.g. /api/artwork?src=...
    return proxied ? `${baseUrl}${proxied}` : null;
  }

  private render(m: {
    title: string;
    description: string;
    canonical: string;
    image: string | null;
    ogType: string;
    redirectTo: string;
  }): string {
    const tags: string[] = [
      `<title>${esc(m.title)}</title>`,
      `<meta name="description" content="${esc(m.description)}" />`,
      `<link rel="canonical" href="${esc(m.canonical)}" />`,
      `<meta property="og:site_name" content="${SITE_NAME}" />`,
      `<meta property="og:type" content="${esc(m.ogType)}" />`,
      `<meta property="og:title" content="${esc(m.title)}" />`,
      `<meta property="og:description" content="${esc(m.description)}" />`,
      `<meta property="og:url" content="${esc(m.canonical)}" />`,
      `<meta name="twitter:title" content="${esc(m.title)}" />`,
      `<meta name="twitter:description" content="${esc(m.description)}" />`,
    ];
    if (m.image) {
      tags.push(
        `<meta property="og:image" content="${esc(m.image)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:image" content="${esc(m.image)}" />`,
      );
    } else {
      tags.push(`<meta name="twitter:card" content="summary" />`);
    }

    // Humans who somehow land here (client not detected as a crawler) get
    // bounced to the real app route.
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${tags.join('\n')}
<meta http-equiv="refresh" content="0; url=${esc(m.redirectTo)}" />
</head>
<body>
<p>Redirecting to <a href="${esc(m.redirectTo)}">${esc(m.title)}</a>…</p>
<script>location.replace(${JSON.stringify(m.redirectTo)});</script>
</body>
</html>`;
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Escape for use inside an HTML attribute or text node. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
