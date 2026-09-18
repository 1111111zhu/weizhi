CREATE TABLE "portal_auth_tickets" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_app" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_auth_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portal_auth_tickets_token_hash_key" ON "portal_auth_tickets"("token_hash");
CREATE INDEX "portal_auth_tickets_user_id_created_at_idx" ON "portal_auth_tickets"("user_id", "created_at");
CREATE INDEX "portal_auth_tickets_target_app_expires_at_idx" ON "portal_auth_tickets"("target_app", "expires_at");

ALTER TABLE "portal_auth_tickets" ADD CONSTRAINT "portal_auth_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
