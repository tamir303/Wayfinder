-- CreateTable
CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "from_code" TEXT NOT NULL,
    "to_code" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "adults" INTEGER NOT NULL,
    "cabin" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_searches_user_id_from_code_to_code_date_adults_cabin_key" ON "saved_searches"("user_id", "from_code", "to_code", "date", "adults", "cabin");

-- CreateIndex
CREATE INDEX "saved_searches_user_id_created_at_idx" ON "saved_searches"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accessed only through the API (service role). No policies: clients cannot read or write it directly.
ALTER TABLE "saved_searches" ENABLE ROW LEVEL SECURITY;
