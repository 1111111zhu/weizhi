ALTER TYPE "ConfirmationTemplateDesignStatus" ADD VALUE 'DISABLED';

CREATE TABLE "confirmation_template_library_builtin_overrides" (
    "template_code" TEXT NOT NULL,
    "design_schema" JSONB,
    "design_status" "ConfirmationTemplateDesignStatus" NOT NULL DEFAULT 'ENABLED',
    "enabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confirmation_template_library_builtin_overrides_pkey" PRIMARY KEY ("template_code")
);

CREATE INDEX "confirmation_template_library_builtin_overrides_design_status_idx"
ON "confirmation_template_library_builtin_overrides"("design_status");
