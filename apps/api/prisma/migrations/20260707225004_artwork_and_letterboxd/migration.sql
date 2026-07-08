-- AlterTable
ALTER TABLE "users" ADD COLUMN "letterboxdSyncedAt" DATETIME;
ALTER TABLE "users" ADD COLUMN "letterboxdUsername" TEXT;

-- CreateTable
CREATE TABLE "user_artwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_artwork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_artwork_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_artwork_mediaItemId_idx" ON "user_artwork"("mediaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "user_artwork_userId_mediaItemId_type_key" ON "user_artwork"("userId", "mediaItemId", "type");
