-- CreateTable
CREATE TABLE "favorite_stays" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stay_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thumbnail" TEXT,
    "stars" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_stays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_stays_user_id_stay_id_key" ON "favorite_stays"("user_id", "stay_id");

-- CreateIndex
CREATE INDEX "favorite_stays_user_id_created_at_idx" ON "favorite_stays"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "favorite_stays" ADD CONSTRAINT "favorite_stays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accessed only through the API (service role). No policies: clients cannot read or write it directly.
ALTER TABLE "favorite_stays" ENABLE ROW LEVEL SECURITY;
