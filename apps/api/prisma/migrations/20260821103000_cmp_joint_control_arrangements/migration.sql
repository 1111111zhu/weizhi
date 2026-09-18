CREATE TABLE "cmp_joint_control_arrangements" (
  "id" TEXT NOT NULL,
  "target_entity_id" TEXT NOT NULL,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "remarks" TEXT,
  "created_by_id" TEXT,
  "reviewed_by_id" TEXT,
  "source_document" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_joint_control_arrangements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cmp_joint_control_arrangements_dates_check"
    CHECK (
      "effective_to" IS NULL OR
      "effective_from" IS NULL OR
      "effective_to" > "effective_from"
    )
);

CREATE TABLE "cmp_joint_control_participants" (
  "arrangement_id" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "ownership_percentage" DECIMAL(5,2),
  "voting_percentage" DECIMAL(5,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_joint_control_participants_pkey"
    PRIMARY KEY ("arrangement_id", "entity_id"),
  CONSTRAINT "cmp_joint_control_participants_ownership_check"
    CHECK (
      "ownership_percentage" IS NULL OR
      ("ownership_percentage" >= 0 AND "ownership_percentage" <= 100)
    ),
  CONSTRAINT "cmp_joint_control_participants_voting_check"
    CHECK (
      "voting_percentage" IS NULL OR
      ("voting_percentage" >= 0 AND "voting_percentage" <= 100)
    )
);

CREATE INDEX "cmp_joint_control_arrangements_target_entity_id_effective_to_idx"
  ON "cmp_joint_control_arrangements"("target_entity_id", "effective_to");

CREATE INDEX "cmp_joint_control_arrangements_effective_to_idx"
  ON "cmp_joint_control_arrangements"("effective_to");

CREATE INDEX "cmp_joint_control_participants_entity_id_idx"
  ON "cmp_joint_control_participants"("entity_id");

ALTER TABLE "cmp_joint_control_arrangements"
  ADD CONSTRAINT "cmp_joint_control_arrangements_target_entity_id_fkey"
  FOREIGN KEY ("target_entity_id") REFERENCES "cmp_entities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cmp_joint_control_participants"
  ADD CONSTRAINT "cmp_joint_control_participants_arrangement_id_fkey"
  FOREIGN KEY ("arrangement_id") REFERENCES "cmp_joint_control_arrangements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_joint_control_participants"
  ADD CONSTRAINT "cmp_joint_control_participants_entity_id_fkey"
  FOREIGN KEY ("entity_id") REFERENCES "cmp_entities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
