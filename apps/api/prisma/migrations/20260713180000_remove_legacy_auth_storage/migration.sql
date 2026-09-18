DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users" AS "user"
    WHERE NOT EXISTS (
      SELECT 1
      FROM "auth_accounts" AS "account"
      WHERE "account"."user_id" = "user"."id"
        AND "account"."provider_id" = 'credential'
        AND "account"."account_id" = "user"."id"
        AND "account"."password" IS NOT NULL
        AND BTRIM("account"."password") <> ''
    )
  ) THEN
    RAISE EXCEPTION
      'Cannot remove legacy password_hash before every user has a credential auth account';
  END IF;
END $$;

DROP TABLE "portal_auth_tickets";

ALTER TABLE "users" DROP COLUMN "password_hash";
