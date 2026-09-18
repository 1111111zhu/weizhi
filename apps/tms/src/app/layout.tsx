import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProjectWingBrowserChrome } from "@/components/project-wing-browser-chrome";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTmsWorkspaceCopy } from "@/i18n/dictionaries";

import "../styles.css";

export const metadata: Metadata = {
  title: { default: "TMS", template: "%s" },
  description: getTmsWorkspaceCopy("zh-CN").metadataDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = "zh-CN";
  return (
    <html lang={locale}>
      <body>
        <ProjectWingBrowserChrome>
          <TooltipProvider>{children}</TooltipProvider>
        </ProjectWingBrowserChrome>
      </body>
    </html>
  );
}
