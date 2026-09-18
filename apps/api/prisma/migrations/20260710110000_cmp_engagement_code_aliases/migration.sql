CREATE TABLE "cmp_engagement_code_aliases" (
    "id" TEXT NOT NULL,
    "engagement_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "normalized_code" TEXT NOT NULL,
    "replaced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cmp_engagement_code_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_engagement_code_aliases_normalized_code_key"
  ON "cmp_engagement_code_aliases"("normalized_code");

CREATE INDEX "cmp_engagement_code_aliases_engagement_id_replaced_at_idx"
  ON "cmp_engagement_code_aliases"("engagement_id", "replaced_at");

ALTER TABLE "cmp_engagement_code_aliases"
  ADD CONSTRAINT "cmp_engagement_code_aliases_engagement_id_fkey"
  FOREIGN KEY ("engagement_id") REFERENCES "cmp_engagements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
