import { ProjectWingLoadingProgress } from "@project-wing/ui";
import { Suspense } from "react";

import { AppLayout } from "../../../components/app-layout";
import { AuthGate } from "../../../components/route-guards";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ProjectWingLoadingProgress />}>
      <AuthGate>
        <AppLayout>{children}</AppLayout>
      </AuthGate>
    </Suspense>
  );
}
