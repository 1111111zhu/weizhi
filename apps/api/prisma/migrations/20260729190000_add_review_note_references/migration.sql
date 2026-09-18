CREATE TABLE "working_paper_question_message_references" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "working_paper_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "working_paper_question_message_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "working_paper_question_message_references_message_id_working_paper_id_key"
ON "working_paper_question_message_references"("message_id", "working_paper_id");

CREATE INDEX "working_paper_question_message_references_working_paper_id_created_at_idx"
ON "working_paper_question_message_references"("working_paper_id", "created_at");

ALTER TABLE "working_paper_question_message_references"
ADD CONSTRAINT "working_paper_question_message_references_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "working_paper_question_messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "working_paper_question_message_references"
ADD CONSTRAINT "working_paper_question_message_references_working_paper_id_fkey"
FOREIGN KEY ("working_paper_id") REFERENCES "working_papers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

WITH ranked_message_files AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "message_id", "object_key"
            ORDER BY "created_at", "id"
        ) AS duplicate_rank
    FROM "working_paper_question_message_images"
)
DELETE FROM "working_paper_question_message_images"
WHERE "id" IN (
    SELECT "id"
    FROM ranked_message_files
    WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX "working_paper_question_message_images_message_id_object_key_key"
ON "working_paper_question_message_images"("message_id", "object_key");
