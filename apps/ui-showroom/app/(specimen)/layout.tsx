import type { Metadata } from "next";

import "@/styles/specimen.css";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Project Wing component specimen",
};

export default function SpecimenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-svh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
