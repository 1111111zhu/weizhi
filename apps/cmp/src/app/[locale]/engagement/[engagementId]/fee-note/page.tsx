import { redirect } from "next/navigation";

export const instant = false;

export default async function EngagementFeeNoteRoute({
  params,
}: {
  params: Promise<{ engagementId: string; locale: string }>;
}) {
  const { engagementId, locale } = await params;
  redirect(`/${locale}/engagement/${engagementId}/billing`);
}
