CREATE TABLE "confirmation_logistics_read_states" (
    "user_id" TEXT NOT NULL,
    "confirmation_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmation_logistics_read_states_pkey" PRIMARY KEY ("user_id", "confirmation_id")
);

ALTER TABLE "confirmation_logistics_read_states" ADD CONSTRAINT "confirmation_logistics_read_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "confirmation_logistics_read_states" ADD CONSTRAINT "confirmation_logistics_read_states_confirmation_id_fkey"
    FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "confirmation_logistics_read_states_confirmation_id_idx"
    ON "confirmation_logistics_read_states"("confirmation_id");
