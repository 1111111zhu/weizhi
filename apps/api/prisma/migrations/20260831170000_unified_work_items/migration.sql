CREATE TYPE "WorkItemRecordStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED', 'WAIVED');

CREATE TYPE "WorkItemResponsibilitySelector" AS ENUM (
  'USER',
  'PROJECT_ALL_MEMBERS',
  'PROJECT_ROLE',
  'PROJECT_IN_CHARGE_ROLE',
  'GLOBAL_ROLE',
  'ENGAGEMENT_PIC_MIC',
  'SYSTEM_THEN'
);

CREATE TYPE "WorkItemEventType" AS ENUM (
  'OPENED',
  'UPDATED',
  'REOPENED',
  'RESOLVED',
  'CANCELLED',
  'WAIVED',
  'RESPONSIBILITY_CHANGED'
);

CREATE TABLE "work_item_records" (
  "id" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "cycle_key" TEXT NOT NULL DEFAULT 'active',
  "domain" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "project_id" TEXT,
  "status" "WorkItemRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "state" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'zh-CN',
  "display_content" TEXT NOT NULL,
  "content_key" TEXT NOT NULL,
  "content_params" JSONB NOT NULL,
  "action_target" JSONB NOT NULL,
  "due_at" TIMESTAMP(3),
  "opened_at" TIMESTAMP(3) NOT NULL,
  "source_updated_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "resolution_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_item_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_item_responsibilities" (
  "id" TEXT NOT NULL,
  "work_item_id" TEXT NOT NULL,
  "selector_type" "WorkItemResponsibilitySelector" NOT NULL,
  "selector_key" TEXT NOT NULL,
  "user_id" TEXT,
  "project_id" TEXT,
  "role_code" TEXT,
  "engagement_id" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_item_responsibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_item_events" (
  "id" TEXT NOT NULL,
  "work_item_id" TEXT NOT NULL,
  "type" "WorkItemEventType" NOT NULL,
  "actor_user_id" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_item_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_item_records_dedupe_key_key"
  ON "work_item_records"("dedupe_key");

CREATE UNIQUE INDEX "work_item_records_rule_subject_cycle_key"
  ON "work_item_records"("rule_id", "subject_type", "subject_id", "cycle_key");

CREATE INDEX "work_item_records_status_domain_updated_at_idx"
  ON "work_item_records"("status", "domain", "updated_at");

CREATE INDEX "work_item_records_project_id_status_updated_at_idx"
  ON "work_item_records"("project_id", "status", "updated_at");

CREATE UNIQUE INDEX "work_item_responsibilities_work_item_selector_key"
  ON "work_item_responsibilities"("work_item_id", "selector_key");

CREATE INDEX "work_item_responsibilities_selector_type_user_id_idx"
  ON "work_item_responsibilities"("selector_type", "user_id");

CREATE INDEX "work_item_responsibilities_selector_type_project_id_idx"
  ON "work_item_responsibilities"("selector_type", "project_id");

CREATE INDEX "work_item_responsibilities_selector_type_role_code_idx"
  ON "work_item_responsibilities"("selector_type", "role_code");

CREATE INDEX "work_item_responsibilities_selector_type_engagement_id_idx"
  ON "work_item_responsibilities"("selector_type", "engagement_id");

CREATE INDEX "work_item_events_work_item_id_created_at_idx"
  ON "work_item_events"("work_item_id", "created_at");

CREATE INDEX "work_item_events_type_created_at_idx"
  ON "work_item_events"("type", "created_at");

ALTER TABLE "work_item_responsibilities"
  ADD CONSTRAINT "work_item_responsibilities_work_item_id_fkey"
  FOREIGN KEY ("work_item_id") REFERENCES "work_item_records"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_item_events"
  ADD CONSTRAINT "work_item_events_work_item_id_fkey"
  FOREIGN KEY ("work_item_id") REFERENCES "work_item_records"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "ensure_active_work_item_has_responsibility"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_work_item_id TEXT;
  target_status "WorkItemRecordStatus";
BEGIN
  IF TG_TABLE_NAME = 'work_item_records' THEN
    IF TG_OP = 'DELETE' THEN
      target_work_item_id := OLD.id;
    ELSE
      target_work_item_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      target_work_item_id := OLD.work_item_id;
    ELSE
      target_work_item_id := NEW.work_item_id;
    END IF;
  END IF;

  SELECT "status"
  INTO target_status
  FROM "work_item_records"
  WHERE "id" = target_work_item_id;

  IF NOT FOUND OR target_status <> 'ACTIVE' THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "work_item_responsibilities"
    WHERE "work_item_id" = target_work_item_id
  ) THEN
    RAISE EXCEPTION 'Active work item % must have at least one responsibility selector', target_work_item_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "work_item_record_responsibility_required"
AFTER INSERT OR UPDATE OF "status" ON "work_item_records"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "ensure_active_work_item_has_responsibility"();

CREATE CONSTRAINT TRIGGER "work_item_responsibility_required_after_change"
AFTER INSERT OR UPDATE OR DELETE ON "work_item_responsibilities"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "ensure_active_work_item_has_responsibility"();
