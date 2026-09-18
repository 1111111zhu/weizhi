import type { ReactNode } from "react";

/** A fresh project-creation attempt must never inherit an abandoned form. */
export default function Template({ children }: { children: ReactNode }) {
  return children;
}
