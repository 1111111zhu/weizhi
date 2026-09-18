import type { Viewport } from "next";

import { MobileIntranet } from "@/components/showroom/specimens/mobile-intranet";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};
export default function Page() {
  return <MobileIntranet />;
}
