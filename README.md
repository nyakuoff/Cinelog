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

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Status

Phase 1 (walking skeleton): auth → TMDB search → media page → watchlist → mark watched → rate. See the roadmap in the project plan for later phases.
