-- CreateEnum
CREATE TYPE "InboxMessageType" AS ENUM ('PROJECT_INVITATION');

-- AlterTable
ALTER TABLE "project_invitations" ADD COLUMN     "recipient_email" TEXT;

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "project_invitation_id" TEXT,
    "type" "InboxMessageType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_project_invitation_id_key" ON "inbox_messages"("project_invitation_id");

-- CreateIndex
CREATE INDEX "inbox_messages_recipient_id_read_at_created_at_idx" ON "inbox_messages"("recipient_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_project_invitation_id_fkey" FOREIGN KEY ("project_invitation_id") REFERENCES "project_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
