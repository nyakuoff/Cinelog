-- Data backfill, not a schema change: watching something (via the status
-- picker, or a Letterboxd/CSV import) never used to create a diary
-- (watch_history) row unless the member separately logged a dated watch, so
-- the Diary tab and the "watched" stats badly undercounted anyone who only
-- rated or marked things complete — including everyone who has ever
-- imported from Letterboxd, since that import only ever set status+rating.
--
-- This backfills one watch_history row for every COMPLETED title that has
-- none yet, dated to when it was marked complete (the closest date we have —
-- the true watched date was never captured, so this is an approximation,
-- not a recovery of the original date).
INSERT INTO "watch_history" ("id", "userId", "mediaItemId", "watchedAt", "isRewatch")
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))),
  s."userId",
  s."mediaItemId",
  COALESCE(s."completedAt", s."updatedAt"),
  0
FROM "user_media_status" s
WHERE s."status" = 'COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM "watch_history" wh
    WHERE wh."userId" = s."userId" AND wh."mediaItemId" = s."mediaItemId"
  );
