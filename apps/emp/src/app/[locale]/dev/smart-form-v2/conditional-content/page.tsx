import { CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE } from "@project-wing/shared";
import { Suspense } from "react";

import { SmartFormV2Preview } from "@/components/smart-form-v2-preview";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConditionalContentSmartFormV2PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <SmartFormV2Preview
        definition={CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE}
      />
    </Suspense>
  );
}
