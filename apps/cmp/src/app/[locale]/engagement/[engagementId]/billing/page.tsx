import { CmpBillingPage } from "@/components/cmp-billing-page";

export const instant = false;

export default async function EngagementBillingRoute({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = await params;
  return <CmpBillingPage engagementId={engagementId} />;
}
