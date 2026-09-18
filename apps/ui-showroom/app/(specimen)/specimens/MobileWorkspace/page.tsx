import type { Viewport } from "next";

import { MobileWorkspaceSpecimen } from "@/components/showroom/specimens/mobile-workspace-specimen";

export const metadata = { title: "EMP" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function MobileWorkspacePage() {
  return (
    <main lang="zh-CN">
      <MobileWorkspaceSpecimen />
    </main>
  );
}
