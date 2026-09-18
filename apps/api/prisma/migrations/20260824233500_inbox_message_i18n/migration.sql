ALTER TABLE "inbox_messages"
ADD COLUMN "content_key" TEXT,
ADD COLUMN "content_params" JSONB;
