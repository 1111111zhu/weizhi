import type { Metadata } from "next";

import { SpecimenRenderer } from "@/components/showroom/specimens/specimen-renderer";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function SpecimenPage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family } = await params;

  return (
    <main className="flex min-h-svh items-center justify-center p-5 sm:p-8">
      <SpecimenRenderer family={decodeURIComponent(family)} />
    </main>
  );
}
