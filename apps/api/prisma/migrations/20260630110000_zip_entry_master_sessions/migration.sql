-- AlterEnum
ALTER TYPE "ZipMasterOperationType" ADD VALUE 'COPY_ENTRY';

-- CreateTable
CREATE TABLE "zip_entry_master_sessions" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "zip_master_session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "entry_path" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "lock_session_id" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "base_hash" TEXT NOT NULL,
  "state" "ZipMasterSessionState" NOT NULL DEFAULT 'OPEN',
  "close_response_json" JSONB,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),

  CONSTRAINT "zip_entry_master_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zip_entry_master_sessions_lock_session_id_key"
ON "zip_entry_master_sessions"("lock_session_id");

-- CreateIndex
CREATE INDEX "zip_entry_master_sessions_zip_master_session_id_entry_path_state_idx"
ON "zip_entry_master_sessions"("zip_master_session_id", "entry_path", "state");

-- CreateIndex
CREATE INDEX "zip_entry_master_sessions_project_id_attachment_id_state_idx"
ON "zip_entry_master_sessions"("project_id", "attachment_id", "state");

-- CreateIndex
CREATE INDEX "zip_entry_master_sessions_user_id_state_idx"
ON "zip_entry_master_sessions"("user_id", "state");

-- AddForeignKey
ALTER TABLE "zip_entry_master_sessions"
ADD CONSTRAINT "zip_entry_master_sessions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zip_entry_master_sessions"
ADD CONSTRAINT "zip_entry_master_sessions_attachment_id_fkey"
FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zip_entry_master_sessions"
ADD CONSTRAINT "zip_entry_master_sessions_zip_master_session_id_fkey"
FOREIGN KEY ("zip_master_session_id") REFERENCES "zip_master_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zip_entry_master_sessions"
ADD CONSTRAINT "zip_entry_master_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
