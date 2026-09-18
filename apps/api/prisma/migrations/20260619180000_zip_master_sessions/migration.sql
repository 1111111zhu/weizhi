-- CreateEnum
CREATE TYPE "ZipMasterSessionState" AS ENUM (
  'OPEN',
  'DIRTY',
  'CHECKING_IN',
  'RELEASING',
  'CHECKIN_FAILED',
  'RELEASE_FAILED',
  'RECOVERABLE',
  'CLOSED',
  'LOCK_REVOKED',
  'BASE_VERSION_CONFLICT',
  'DRAFT_EXPIRED'
);

-- CreateEnum
CREATE TYPE "ZipMasterOperationType" AS ENUM (
  'ADD_FILE',
  'REPLACE_FILE',
  'DELETE_ENTRY',
  'RENAME_ENTRY',
  'MOVE_ENTRY',
  'CREATE_FOLDER'
);

-- CreateTable
CREATE TABLE "zip_master_sessions" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "lock_session_id" TEXT NOT NULL,
  "base_version" INTEGER NOT NULL,
  "base_hash" TEXT NOT NULL,
  "state" "ZipMasterSessionState" NOT NULL DEFAULT 'OPEN',
  "dirty" BOOLEAN NOT NULL DEFAULT false,
  "close_response_json" JSONB,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),

  CONSTRAINT "zip_master_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zip_master_operations" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" "ZipMasterOperationType" NOT NULL,
  "entry_path" TEXT NOT NULL,
  "target_path" TEXT,
  "object_key" TEXT,
  "file_name" TEXT,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "zip_master_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zip_master_sessions_lock_session_id_key" ON "zip_master_sessions"("lock_session_id");

-- CreateIndex
CREATE INDEX "zip_master_sessions_project_id_attachment_id_state_idx" ON "zip_master_sessions"("project_id", "attachment_id", "state");

-- CreateIndex
CREATE INDEX "zip_master_sessions_user_id_state_idx" ON "zip_master_sessions"("user_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "zip_master_operations_session_id_sequence_key" ON "zip_master_operations"("session_id", "sequence");

-- CreateIndex
CREATE INDEX "zip_master_operations_session_id_created_at_idx" ON "zip_master_operations"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "zip_master_sessions"
ADD CONSTRAINT "zip_master_sessions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zip_master_sessions"
ADD CONSTRAINT "zip_master_sessions_attachment_id_fkey"
FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zip_master_sessions"
ADD CONSTRAINT "zip_master_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zip_master_operations"
ADD CONSTRAINT "zip_master_operations_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "zip_master_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
