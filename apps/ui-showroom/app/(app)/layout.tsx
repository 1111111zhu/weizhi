import { SoundProvider } from "@web-kits/audio/react";
import type { Metadata } from "next";

import { Analytics } from "@/components/analytics";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { WebMcpTools } from "@/components/web-mcp-tools";
import { META_THEME_COLORS } from "@/constants/site";
import { AGENT_DOCS_DIRECTIVE_TEXT } from "@/lib/agent-discovery/directive";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { JsonLdScripts } from "@/seo/json-ld";
import { baseMetadata } from "@/seo/metadata";

import "@/styles/globals.css";
import "@project-wing/pdf-template-designer/styles.css";

export const metadata: Metadata = baseMetadata;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="en" suppressHydrationWarning>
      <head>
        <JsonLdScripts />
        <meta
          name="theme-color"
          content={META_THEME_COLORS.light}
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content={META_THEME_COLORS.dark}
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body
        className={cn(
          "group/body min-h-svh bg-background font-sans text-foreground antialiased [--footer-height:--spacing(14)] [--header-height:--spacing(14)] xl:[--footer-height:--spacing(24)]",
          fontVariables
        )}
      >
        <SoundProvider>
          <ThemeProvider>
            <div className="relative flex min-h-svh flex-col bg-background">
              <blockquote className="sr-only">
                {AGENT_DOCS_DIRECTIVE_TEXT}
              </blockquote>
              <WebMcpTools />
              <SiteHeader />
              <main className="flex flex-1 flex-col">{children}</main>
            </div>
            <Toaster position="top-center" />
            <Analytics />
          </ThemeProvider>
        </SoundProvider>
      </body>
    </html>
  );
}
