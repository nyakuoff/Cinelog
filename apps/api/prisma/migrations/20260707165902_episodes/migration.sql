-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaItemId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "posterPath" TEXT,
    "airDate" TEXT,
    "episodeCount" INTEGER NOT NULL DEFAULT 0,
    "cachedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seasons_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "stillPath" TEXT,
    "airDate" TEXT,
    "runtime" INTEGER,
    CONSTRAINT "episodes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "episode_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "episode_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "episode_ratings_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "seasons_mediaItemId_idx" ON "seasons"("mediaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_mediaItemId_seasonNumber_key" ON "seasons"("mediaItemId", "seasonNumber");

-- CreateIndex
CREATE INDEX "episodes_seasonId_idx" ON "episodes"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_seasonId_episodeNumber_key" ON "episodes"("seasonId", "episodeNumber");

-- CreateIndex
CREATE INDEX "episode_ratings_episodeId_idx" ON "episode_ratings"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "episode_ratings_userId_episodeId_key" ON "episode_ratings"("userId", "episodeId");
