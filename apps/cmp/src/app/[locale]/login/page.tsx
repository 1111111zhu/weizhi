import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { LoginClient } from "./page-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
