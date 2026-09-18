import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_REFERENCE_OPTIONS,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
import { Suspense } from "react";

import { SmartFormV2Preview } from "@/components/smart-form-v2-preview";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeferredIncomeSmartFormV2PreviewPage() {
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
        definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
        response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
        referenceOptions={DEFERRED_INCOME_SMART_FORM_V2_REFERENCE_OPTIONS}
      />
    </Suspense>
  );
}
