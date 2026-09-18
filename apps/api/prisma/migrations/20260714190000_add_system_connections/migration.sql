CREATE TYPE "SystemConnectionProvider" AS ENUM ('TRACKING_17TRACK');

CREATE TYPE "SystemConnectionStatus" AS ENUM ('CONNECTED', 'ERROR');

CREATE TABLE "system_connections" (
    "id" TEXT NOT NULL,
    "provider" "SystemConnectionProvider" NOT NULL,
    "credential_ciphertext" TEXT NOT NULL,
    "credential_iv" TEXT NOT NULL,
    "credential_auth_tag" TEXT NOT NULL,
    "status" "SystemConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "verified_at" TIMESTAMP(3),
    "last_tested_at" TIMESTAMP(3),
    "last_error" TEXT,
    "quota_total" INTEGER,
    "quota_used" INTEGER,
    "quota_remain" INTEGER,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_connections_provider_key" ON "system_connections"("provider");
CREATE INDEX "system_connections_status_idx" ON "system_connections"("status");

ALTER TABLE "system_connections"
ADD CONSTRAINT "system_connections_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
