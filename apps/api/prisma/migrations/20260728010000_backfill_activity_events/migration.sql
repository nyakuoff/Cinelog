-- Data backfill, not a schema change.
--
-- The activity feed is written inline from the write paths (rate, review,
-- watch, favorite, follow, create-list), so it only ever contained events
-- from actions taken *after* that code shipped. Everything members did
-- before it — plus everything that arrives via a Letterboxd/CSV/backup
-- import, which bypasses those paths entirely — produced no events, leaving
-- the feed empty on an instance that already had plenty of real history.
--
-- This seeds one event per existing action, keeping each action's own
-- timestamp so the feed reads chronologically instead of dumping everything
-- at "now". Every insert is guarded with NOT EXISTS so it can't duplicate
-- events already recorded live, and the gating mirrors the write paths
-- exactly (favorites only when still favorited, lists only when public).
--
-- Rewatches collapse to a single WATCHED per title, matching the
-- recordReplacing() behaviour the live path uses.

-- RATED
INSERT INTO "activity_events" ("id", "actorId", "type", "mediaItemId", "createdAt")
SELECT lower(hex(randomblob(12))), r."userId", 'RATED', r."mediaItemId", r."updatedAt"
FROM "ratings" r
WHERE NOT EXISTS (
  SELECT 1 FROM "activity_events" a
  WHERE a."actorId" = r."userId" AND a."type" = 'RATED' AND a."mediaItemId" = r."mediaItemId"
);

-- REVIEWED
INSERT INTO "activity_events" ("id", "actorId", "type", "mediaItemId", "reviewId", "createdAt")
SELECT lower(hex(randomblob(12))), rv."userId", 'REVIEWED', rv."mediaItemId", rv."id", rv."createdAt"
FROM "reviews" rv
WHERE rv."targetType" = 'MEDIA'
  AND NOT EXISTS (
    SELECT 1 FROM "activity_events" a
    WHERE a."actorId" = rv."userId" AND a."type" = 'REVIEWED' AND a."mediaItemId" = rv."mediaItemId"
  );

-- WATCHED (one per title, dated to the most recent watch)
INSERT INTO "activity_events" ("id", "actorId", "type", "mediaItemId", "createdAt")
SELECT lower(hex(randomblob(12))), wh."userId", 'WATCHED', wh."mediaItemId", MAX(wh."watchedAt")
FROM "watch_history" wh
WHERE NOT EXISTS (
  SELECT 1 FROM "activity_events" a
  WHERE a."actorId" = wh."userId" AND a."type" = 'WATCHED' AND a."mediaItemId" = wh."mediaItemId"
)
GROUP BY wh."userId", wh."mediaItemId";

-- FAVORITED (only titles still marked favorite, matching setFavorite's retraction)
INSERT INTO "activity_events" ("id", "actorId", "type", "mediaItemId", "createdAt")
SELECT lower(hex(randomblob(12))), s."userId", 'FAVORITED', s."mediaItemId", s."updatedAt"
FROM "user_media_status" s
WHERE s."isFavorite" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "activity_events" a
    WHERE a."actorId" = s."userId" AND a."type" = 'FAVORITED' AND a."mediaItemId" = s."mediaItemId"
  );

-- FOLLOWED (blocked pairs already have their follow rows removed, so this
-- can't resurrect a relationship a block severed)
INSERT INTO "activity_events" ("id", "actorId", "type", "targetUserId", "createdAt")
SELECT lower(hex(randomblob(12))), f."followerId", 'FOLLOWED', f."followingId", f."createdAt"
FROM "follows" f
WHERE NOT EXISTS (
  SELECT 1 FROM "activity_events" a
  WHERE a."actorId" = f."followerId" AND a."type" = 'FOLLOWED' AND a."targetUserId" = f."followingId"
);

-- LIST_CREATED (public lists only, matching create/update gating)
INSERT INTO "activity_events" ("id", "actorId", "type", "listId", "createdAt")
SELECT lower(hex(randomblob(12))), l."userId", 'LIST_CREATED', l."id", l."createdAt"
FROM "lists" l
WHERE l."isPublic" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "activity_events" a
    WHERE a."type" = 'LIST_CREATED' AND a."listId" = l."id"
  );
