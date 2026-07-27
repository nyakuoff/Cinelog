# Cinelog Social Upgrade — Progress

Tracks the multi-session upgrade from a private rating tool into a Letterboxd-style social
discovery platform. See the approved plan for full context and rationale.

## Completed

### Slice 1 — Schema foundation (2026-07-27)

- Added `displayName`, `profileVisibility`, `watchlistVisibility` to `User`.
- Added `favoritePosition` (1–4, unique per user) to `UserMediaStatus` — this is how the
  "4 favorite titles" feature is implemented, reusing the existing tracking table instead of
  a new one.
- New models: `Review`, `ReviewLike`, `ReviewComment`, `Follow`, `UserBlock`, `List`,
  `ListItem`, `ListLike`, `ListComment`, `ActivityEvent`, `Notification`, `ContentReport`,
  `ModerationAction`.
- New Zod enums in `packages/contracts/src/enums.ts`: `ProfileVisibility`, `ActivityType`,
  `NotificationType`, `ReportTargetType`, `ReportStatus`.
- Migration: `apps/api/prisma/migrations/20260727000000_social_foundation/migration.sql`
  (additive only — one `ALTER TABLE ADD COLUMN`, several `CREATE TABLE`, and a SQLite-required
  table-rebuild of `users` to add the three new nullable/defaulted columns, which preserves all
  existing rows via `INSERT INTO new_users SELECT ... FROM users`).
- `apps/api/src/backup/backup.service.ts` + `packages/contracts/src/backup.ts` extended to
  export/import `favoritePosition` and a media review per `BackupItem`. Old backups (missing
  these fields) still parse via Zod `.optional().default(...)`.

**Verification run:**
- `pnpm --filter @cinelog/contracts build` — pass
- `pnpm --filter @cinelog/api typecheck` — pass
- `pnpm --filter @cinelog/api test` — 2 suites / 7 tests pass
- Applied migration against the real dev DB (`apps/api/data/cinelog.db`) via
  `prisma migrate deploy` (non-interactive `migrate dev` isn't supported in this environment,
  so the migration SQL was generated with `prisma migrate diff --script` and committed as a
  normal migration directory, then applied with `deploy`). Confirmed via `sqlite3`: existing
  user/rating/status rows are untouched after migration; new `reviews` table exists and is
  empty.

## Not yet started

- Slice 2: nav/layout rework (Discover-as-home, dedicated Profile tab), public profiles API +
  `PublicProfilePage`, favorites reorder UI, `/settings` split out from `/profile`.
- Slice 3: Discover page (community + provider-sourced sections, filters, personalization).
- Slice 4: Reviews/likes/comments API + UI on `MediaDetailPage`.
- Slice 5: Watchlist/diary surfaced on profile + diary edit/delete endpoints.
- Slice 6: Follow graph, blocking, activity feed.
- Slice 7: Lists.
- Slice 8: User/list search, notifications.
- Moderation UI (report queue, admin actions) — schema (`ContentReport`, `ModerationAction`)
  is in place from slice 1; no endpoints/UI yet.

## Known limitations / decisions

- Backup/restore does not yet cover `Follow`, `List`, or `ReviewLike`/`ReviewComment` — only
  per-media favorites and the review body/rating are round-tripped. Follows/lists are
  cross-user relations that need more thought (e.g. a followed username may not exist on the
  target install) — deferred to when the Lists/Follow slices land.
- `favoritePosition` restore skips a slot if it's already occupied by a different title on the
  target account, rather than overwriting — avoids surprising data loss on merge-import.
- Lint is unconfigured in both apps (pre-existing; `pnpm lint` is a no-op). Not addressed in
  this slice — flagging for a future slice if the team wants ESLint added.
