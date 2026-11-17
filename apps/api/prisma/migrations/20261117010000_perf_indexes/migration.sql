-- DropIndex
DROP INDEX "follows_followingId_idx";

-- DropIndex
DROP INDEX "reviews_userId_idx";

-- DropIndex
DROP INDEX "reviews_mediaItemId_idx";

-- DropIndex
DROP INDEX "user_media_status_userId_idx";

-- DropIndex
DROP INDEX "watch_history_userId_idx";

-- CreateIndex
CREATE INDEX "activity_events_createdAt_idx" ON "activity_events"("createdAt");

-- CreateIndex
CREATE INDEX "follows_followingId_createdAt_idx" ON "follows"("followingId", "createdAt");

-- CreateIndex
CREATE INDEX "media_items_cachedAt_idx" ON "media_items"("cachedAt");

-- CreateIndex
CREATE INDEX "media_items_releaseDate_idx" ON "media_items"("releaseDate");

-- CreateIndex
CREATE INDEX "reviews_mediaItemId_createdAt_idx" ON "reviews"("mediaItemId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_userId_createdAt_idx" ON "reviews"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_media_status_userId_updatedAt_idx" ON "user_media_status"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "watch_history_userId_watchedAt_idx" ON "watch_history"("userId", "watchedAt");

