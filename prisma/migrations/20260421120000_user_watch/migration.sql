-- CreateTable
CREATE TABLE "UserWatch" (
    "id" TEXT NOT NULL,
    "watcher_id" TEXT NOT NULL,
    "watched_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWatch_watcher_id_watched_user_id_key" ON "UserWatch"("watcher_id", "watched_user_id");

-- CreateIndex
CREATE INDEX "UserWatch_watched_user_id_idx" ON "UserWatch"("watched_user_id");

-- AddForeignKey
ALTER TABLE "UserWatch" ADD CONSTRAINT "UserWatch_watcher_id_fkey" FOREIGN KEY ("watcher_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWatch" ADD CONSTRAINT "UserWatch_watched_user_id_fkey" FOREIGN KEY ("watched_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
