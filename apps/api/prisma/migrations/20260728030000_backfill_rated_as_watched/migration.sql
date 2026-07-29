-- Data backfill, not a schema change.
--
-- A title's "Watched by" / "Liked by" / "Reviews" tallies, and a profile's
-- Films/Shows counts, are all derived from watch_history, isFavorite, and
-- reviews. Rating a title used to write none of those, so anything the member
-- had only rated stayed at zero everywhere it was counted — which is what made
-- an already-rated film's ON CINELOG panel read "Watched by 0".
--
-- Rating now implies watched (see RatingsService.markWatchedByRating), so this
-- brings existing data in line with that rule:
--   1. every rated title with no status gets COMPLETED
--   2. every rated title with no diary row gets one
--
-- Likes are deliberately NOT invented here: there is no existing signal to
-- derive them from, and fabricating them would put claims in members' profiles
-- they never made. A Letterboxd export does carry likes, and the ZIP import
-- writes them.

-- 1. Rated but never given a status.
UPDATE "user_media_status"
SET "status" = 'COMPLETED',
    "completedAt" = COALESCE("completedAt", "updatedAt")
WHERE "status" IS NULL
  AND EXISTS (
    SELECT 1 FROM "ratings" r
    WHERE r."userId" = "user_media_status"."userId"
      AND r."mediaItemId" = "user_media_status"."mediaItemId"
  );

-- A rating with no status row at all still needs one.
INSERT INTO "user_media_status" ("id", "userId", "mediaItemId", "status", "completedAt", "isFavorite", "isWatchlisted", "rewatchCount", "updatedAt", "createdAt")
SELECT
  lower(hex(randomblob(12))),
  r."userId",
  r."mediaItemId",
  'COMPLETED',
  r."updatedAt",
  0, 0, 0,
  r."updatedAt",
  r."createdAt"
FROM "ratings" r
WHERE NOT EXISTS (
  SELECT 1 FROM "user_media_status" s
  WHERE s."userId" = r."userId" AND s."mediaItemId" = r."mediaItemId"
);

-- 2. Rated but never logged, so it never counted as watched.
INSERT INTO "watch_history" ("id", "userId", "mediaItemId", "watchedAt", "isRewatch")
SELECT
  lower(hex(randomblob(12))),
  r."userId",
  r."mediaItemId",
  r."updatedAt",
  0
FROM "ratings" r
WHERE NOT EXISTS (
  SELECT 1 FROM "watch_history" wh
  WHERE wh."userId" = r."userId" AND wh."mediaItemId" = r."mediaItemId"
);

-- Keep the feed consistent with what just became true.
INSERT INTO "activity_events" ("id", "actorId", "type", "mediaItemId", "createdAt")
SELECT lower(hex(randomblob(12))), wh."userId", 'WATCHED', wh."mediaItemId", MAX(wh."watchedAt")
FROM "watch_history" wh
WHERE NOT EXISTS (
  SELECT 1 FROM "activity_events" a
  WHERE a."actorId" = wh."userId" AND a."type" = 'WATCHED' AND a."mediaItemId" = wh."mediaItemId"
)
GROUP BY wh."userId", wh."mediaItemId";
