ALTER TABLE "smart_form_templates" ALTER COLUMN "framework_template_id" DROP NOT NULL;
ALTER TABLE "smart_form_templates" DROP CONSTRAINT "smart_form_templates_framework_template_id_fkey";
ALTER TABLE "smart_form_templates" ADD CONSTRAINT "smart_form_templates_framework_template_id_fkey" FOREIGN KEY ("framework_template_id") REFERENCES "framework_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
