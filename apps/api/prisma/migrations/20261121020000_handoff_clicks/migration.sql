-- CreateTable
CREATE TABLE "handoff_clicks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "price" INTEGER,
    "currency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoff_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "handoff_clicks_user_id_created_at_idx" ON "handoff_clicks"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "handoff_clicks" ADD CONSTRAINT "handoff_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Written only by the API (service role). No policies: clients cannot read or write it directly.
ALTER TABLE "handoff_clicks" ENABLE ROW LEVEL SECURITY;
