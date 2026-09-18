-- Keep the legacy hash only for the additive migration window. New users are
-- created with a Better Auth credential account, so they must not require it.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
