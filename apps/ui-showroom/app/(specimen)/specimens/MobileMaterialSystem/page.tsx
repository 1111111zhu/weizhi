import type { Viewport } from "next";

import { MobileMaterialSystem } from "@/components/showroom/specimens/mobile-material-system";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};
export default function Page() {
  return <MobileMaterialSystem />;
}
