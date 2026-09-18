CREATE TABLE "cmp_approval_number_sequences" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cmp_approval_number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_approval_number_sequences_prefix_year_key"
ON "cmp_approval_number_sequences"("prefix", "year");
