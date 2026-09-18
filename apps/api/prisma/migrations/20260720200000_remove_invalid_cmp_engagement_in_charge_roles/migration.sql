UPDATE "project_members" AS member
SET
  "in_charge_role" = NULL,
  "updated_at" = NOW()
FROM "projects" AS project
JOIN "cmp_engagements" AS engagement
  ON engagement."id" = project."cmp_engagement_id"
WHERE member."project_id" = project."id"
  AND project."status" IN ('ACTIVE', 'PENDING_FINAL_CHECK')
  AND (
    (
      member."in_charge_role" = 'PARTNER_IN_CHARGE'
      AND (
        member."user_id" IS DISTINCT FROM engagement."pic_user_id"
        OR NOT EXISTS (
          SELECT 1
          FROM "users" AS responsible_user
          WHERE responsible_user."id" = engagement."pic_user_id"
            AND responsible_user."status" = 'ACTIVE'
            AND responsible_user."global_role" IN ('PARTNER', 'PRINCIPAL')
        )
      )
    )
    OR (
      member."in_charge_role" = 'MANAGER_IN_CHARGE'
      AND (
        member."user_id" IS DISTINCT FROM engagement."mic_user_id"
        OR NOT EXISTS (
          SELECT 1
          FROM "users" AS responsible_user
          WHERE responsible_user."id" = engagement."mic_user_id"
            AND responsible_user."status" = 'ACTIVE'
            AND responsible_user."global_role" IN ('MANAGER', 'SENIOR_MANAGER')
        )
      )
    )
  );
