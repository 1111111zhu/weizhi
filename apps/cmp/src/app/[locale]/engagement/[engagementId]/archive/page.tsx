import { CmpEngagementArchivePage } from "@/components/cmp-engagement-archive-page";

export const instant = false;

export default async function EngagementArchiveRoute({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = await params;
  return <CmpEngagementArchivePage engagementId={engagementId} />;
}
