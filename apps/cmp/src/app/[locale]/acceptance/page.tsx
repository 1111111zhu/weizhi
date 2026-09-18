import { Suspense } from "react";

import { CmpAcceptanceClient } from "./page-client";

export const instant = false;

export default function AcceptancePage() {
  return (
    <Suspense
      fallback={
        <main className="cmp-centered">Loading acceptance workspace</main>
      }
    >
      <CmpAcceptanceClient />
    </Suspense>
  );
}
