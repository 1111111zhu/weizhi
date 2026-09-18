-- The service validates these branches. Keep the participant method invariant
-- at the database boundary as well, so direct SQL cannot reintroduce a voting
-- style hybrid or an undocumented "other" method.
ALTER TABLE "cmp_group_relationship_participants"
  ADD CONSTRAINT "cmp_group_relationship_participants_method_check"
  CHECK (
    ("method" = 'OWNERSHIP' AND "other_description" IS NULL)
    OR (
      "method" = 'OTHER'
      AND "ownership_percentage" IS NULL
      AND length(btrim("other_description")) > 0
    )
  );
