CREATE TYPE "ConfirmationTemplateDesignStatus" AS ENUM ('DRAFT', 'ENABLED');

ALTER TABLE "confirmation_template_library_files"
    ADD COLUMN "design_schema" JSONB,
    ADD COLUMN "design_status" "ConfirmationTemplateDesignStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "enabled_at" TIMESTAMP(3);
