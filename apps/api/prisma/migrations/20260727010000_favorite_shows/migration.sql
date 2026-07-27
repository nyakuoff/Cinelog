-- AlterTable
ALTER TABLE "user_media_status" ADD COLUMN "favoriteShowPosition" INTEGER;

-- Move any existing favorite slots that point at non-movie media into the new
-- show column, so pre-existing favorites split correctly instead of silently
-- vanishing from the films row.
UPDATE "user_media_status"
SET "favoriteShowPosition" = "favoritePosition", "favoritePosition" = NULL
WHERE "favoritePosition" IS NOT NULL
  AND "mediaItemId" IN (SELECT "id" FROM "media_items" WHERE "type" != 'MOVIE');

-- CreateIndex
CREATE UNIQUE INDEX "user_media_status_userId_favoriteShowPosition_key" ON "user_media_status"("userId", "favoriteShowPosition");
