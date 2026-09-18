-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('BANK', 'BALANCE', 'RELATED_PARTY', 'LAWYER', 'INTERMEDIARY', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('DRAFT', 'PREPARED', 'SENT', 'AWAITING_RESPONSE', 'RETURNED_ASSIGNED', 'UNDER_REVIEW', 'MATCHED', 'EXCEPTION', 'NO_RESPONSE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfirmationDispatchMethod" AS ENUM ('COURIER', 'POST', 'EMAIL', 'PLATFORM', 'BANK_PORTAL', 'HAND_DELIVERY', 'OTHER');

-- CreateTable
CREATE TABLE "project_confirmations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ConfirmationType" NOT NULL,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'DRAFT',
    "counterparty_name" TEXT NOT NULL,
    "counterparty_contact" TEXT,
    "counterparty_address" TEXT,
    "responsible_user_id" TEXT,
    "planned_send_date" TIMESTAMP(3),
    "report_deadline" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_confirmation_dispatches" (
    "id" TEXT NOT NULL,
    "confirmation_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "method" "ConfirmationDispatchMethod" NOT NULL DEFAULT 'COURIER',
    "sent_at" TIMESTAMP(3),
    "courier_name" TEXT,
    "tracking_number" TEXT,
    "recipient_name" TEXT,
    "recipient_contact" TEXT,
    "recipient_phone" TEXT,
    "follow_up_date" TIMESTAMP(3),
    "attachment_name" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_confirmation_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_confirmation_responses" (
    "id" TEXT NOT NULL,
    "confirmation_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3),
    "received_by" TEXT,
    "attachment_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_confirmation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_confirmations_project_id_status_updated_at_idx" ON "project_confirmations"("project_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "project_confirmations_responsible_user_id_idx" ON "project_confirmations"("responsible_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_confirmation_dispatches_confirmation_id_sequence_key" ON "project_confirmation_dispatches"("confirmation_id", "sequence");

-- CreateIndex
CREATE INDEX "project_confirmation_dispatches_confirmation_id_created_at_idx" ON "project_confirmation_dispatches"("confirmation_id", "created_at");

-- CreateIndex
CREATE INDEX "project_confirmation_responses_confirmation_id_received_at_idx" ON "project_confirmation_responses"("confirmation_id", "received_at");

-- AddForeignKey
ALTER TABLE "project_confirmations" ADD CONSTRAINT "project_confirmations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_confirmations" ADD CONSTRAINT "project_confirmations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_confirmations" ADD CONSTRAINT "project_confirmations_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_confirmation_dispatches" ADD CONSTRAINT "project_confirmation_dispatches_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_confirmation_responses" ADD CONSTRAINT "project_confirmation_responses_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
