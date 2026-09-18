CREATE TYPE "UserMailProvider" AS ENUM ('WECOM_EXMAIL');

CREATE TYPE "UserMailConnectionStatus" AS ENUM ('CONNECTED', 'ERROR');

CREATE TABLE "user_mail_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "UserMailProvider" NOT NULL DEFAULT 'WECOM_EXMAIL',
    "email_address" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL DEFAULT 'smtp.exmail.qq.com',
    "smtp_port" INTEGER NOT NULL DEFAULT 465,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT true,
    "credential_ciphertext" TEXT NOT NULL,
    "credential_iv" TEXT NOT NULL,
    "credential_auth_tag" TEXT NOT NULL,
    "status" "UserMailConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "verified_at" TIMESTAMP(3),
    "last_tested_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mail_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_mail_connections_user_id_key" ON "user_mail_connections"("user_id");
CREATE INDEX "user_mail_connections_status_idx" ON "user_mail_connections"("status");

ALTER TABLE "user_mail_connections"
ADD CONSTRAINT "user_mail_connections_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_confirmation_dispatches"
ADD COLUMN "sender_email" TEXT,
ADD COLUMN "recipient_email" TEXT,
ADD COLUMN "email_subject" TEXT,
ADD COLUMN "email_body_text" TEXT;
