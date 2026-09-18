"use client";

import { CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE } from "@project-wing/shared";
import { Suspense } from "react";

import { SmartFormV2TemplateDesigner } from "@/components/smart-form-v2-template-designer";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";

function DesignerContent() {
  const { dictionary, locale } = useI18n();
  return (
    <SmartFormV2TemplateDesigner
      initialDefinition={CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE}
      locale={locale}
      copy={dictionary.smartFormV2Designer}
      readonlyCopy={dictionary.smartFormV2Preview}
    />
  );
}

export default function ConditionalContentSmartFormV2DesignerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full flex-col gap-4 p-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-full w-full" />
        </div>
      }
    >
      <DesignerContent />
    </Suspense>
  );
}
