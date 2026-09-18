CREATE TABLE "webhook_ingress_receipts" (
    "message_id" TEXT NOT NULL,
    "provider" "SystemConnectionProvider" NOT NULL,
    "request_id" TEXT,
    "body_sha256" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_ingress_receipts_pkey" PRIMARY KEY ("message_id")
);

CREATE INDEX "webhook_ingress_receipts_provider_processed_at_idx"
ON "webhook_ingress_receipts"("provider", "processed_at");
