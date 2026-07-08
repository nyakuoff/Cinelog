# Cinelog

A self-hosted media watchlist & review platform — think Letterboxd, but for **every** kind of visual media (movies, TV, anime, cartoons, documentaries, mini-series, specials). Multiple users each keep their own independent watchlists, tracking, ratings, and reviews.

Cinelog is a **companion** app — it does not play media. It tracks and reviews it.

## Stack

- **API** — [NestJS](https://nestjs.com/) (TypeScript), Prisma ORM, SQLite
- **Web** — React + Vite + Tailwind, TanStack Query/Router
- **Contracts** — shared Zod schemas (`packages/contracts`) consumed by both API and web
- **Metadata** — pluggable provider layer (TMDB first; TVDB + AniList behind the same interface)

## Monorepo layout

```
apps/api         NestJS REST API (only thing that touches the DB)
apps/web         React SPA (consumes the API like any external client)
packages/contracts  Shared Zod schemas + inferred types
packages/config     Shared tsconfig / eslint
prisma            schema.prisma + migrations (lives in apps/api)
data/            Runtime volume: sqlite db, artwork cache, uploads (gitignored)
```

## Getting started (dev)

```bash
pnpm install
cp .env.example .env          # then set TMDB_API_KEY and JWT secrets
pnpm db:migrate               # create the SQLite database
pnpm dev                      # API on :3000, web on :5173
```

Open http://localhost:5173 — on first run you'll create the admin account.
API docs (Swagger) are at http://localhost:3000/api/docs.

## Docker (self-hosting)

Images are built by CI and published to the GitHub Container Registry
(`ghcr.io/nyakuoff/cinelog-api` + `-web`) on every push to `main`. **The host
never needs the source** — just `docker-compose.yml` and a `.env`.

On your server (Docker Engine + Compose v2):

```bash
# Grab just the compose file + env template
curl -O https://raw.githubusercontent.com/nyakuoff/Cinelog/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/nyakuoff/Cinelog/main/.env.example

# Set strong auth secrets + your TMDB key
sed -i "s/^JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$(openssl rand -hex 32)/" .env
# edit .env → TMDB_API_KEY=...

docker compose up -d          # pulls prebuilt images, no build step
```

Open **http://localhost:8080** (or your server's host/IP) — on first run you
create the admin account.

> **One-time:** GHCR packages are private by default. Either make the two
> packages public on GitHub (Packages → each package → Change visibility →
> Public) so any host can pull, or run `docker login ghcr.io` on the host with a
> PAT that has `read:packages`.

Only four variables from `.env` are read by Compose (`JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `TMDB_API_KEY`, `TMDB_ACCESS_TOKEN`); everything else
(ports, DB path, CORS) is set inside `docker-compose.yml`. The two services:

- **api** — NestJS; runs `prisma migrate deploy` on boot, stores the SQLite DB +
  artwork cache + uploads in the `cinelog-data` volume. Not published directly.
- **web** — nginx serving the built SPA and reverse-proxying `/api` to the api
  container. Published on host port **8080** (change the `ports:` mapping to move it).

Useful commands:

```bash
docker compose pull && docker compose up -d   # update to the latest images
docker compose logs -f                         # tail logs
docker compose down                            # stop (keeps the data volume)
docker compose down -v                         # stop and DELETE all data
```

Pin a version or use a fork by overriding the image coordinates:
`CINELOG_OWNER=you CINELOG_TAG=v1.2.3 docker compose up -d`.

To build the images yourself from source instead of pulling, use the build
compose file:

```bash
docker compose -f docker-compose.build.yml up --build -d
```

Your library lives in the `cinelog-data` Docker volume — back it up to keep your data.

## Status

Phase 1 (walking skeleton): auth → TMDB search → media page → watchlist → mark watched → rate. See the roadmap in the project plan for later phases.
