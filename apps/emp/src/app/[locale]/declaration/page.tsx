import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { DeclarationPage } from "../../../views/declaration";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Skeleton className="h-96 w-full max-w-lg" />
        </div>
      }
    >
      <DeclarationPage />
    </Suspense>
  );
}
