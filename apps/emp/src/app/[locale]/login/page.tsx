import { ProjectWingLoadingProgress } from "@project-wing/ui";
import { Suspense } from "react";

import { LoginPage } from "../../../views/login";

export default function Page() {
  return (
    <Suspense fallback={<ProjectWingLoadingProgress />}>
      <LoginPage />
    </Suspense>
  );
}
