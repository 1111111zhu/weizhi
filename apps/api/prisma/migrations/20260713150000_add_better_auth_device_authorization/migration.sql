-- CreateTable
CREATE TABLE "auth_device_codes" (
    "id" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "user_code" TEXT NOT NULL,
    "user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "last_polled_at" TIMESTAMP(3),
    "polling_interval" INTEGER,
    "client_id" TEXT,
    "scope" TEXT,

    CONSTRAINT "auth_device_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_device_codes_device_code_key" ON "auth_device_codes"("device_code");

-- CreateIndex
CREATE UNIQUE INDEX "auth_device_codes_user_code_key" ON "auth_device_codes"("user_code");

-- CreateIndex
CREATE INDEX "auth_device_codes_expires_at_idx" ON "auth_device_codes"("expires_at");

-- CreateIndex
CREATE INDEX "auth_device_codes_user_id_idx" ON "auth_device_codes"("user_id");
