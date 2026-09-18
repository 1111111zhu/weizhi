CREATE TABLE "working_paper_question_message_images" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "original_name" TEXT,
  "object_key" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "mime_type" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "working_paper_question_message_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_paper_question_message_images_message_id_created_at_idx"
  ON "working_paper_question_message_images"("message_id", "created_at");

ALTER TABLE "working_paper_question_message_images"
  ADD CONSTRAINT "working_paper_question_message_images_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "working_paper_question_messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
