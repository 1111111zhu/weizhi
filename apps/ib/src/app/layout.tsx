import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@project-wing/ui/mobile-material.css";

import { ProjectWingBrowserChrome } from "@/components/project-wing-browser-chrome";

export const metadata: Metadata = {
  title: { default: "IB", template: "%s" },
  description: "Information Bridge client portal for Project Wing",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = "zh-CN";
  return (
    <html lang={locale}>
      <body>
        <ProjectWingBrowserChrome>{children}</ProjectWingBrowserChrome>
      </body>
    </html>
  );
}
