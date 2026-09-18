import { CmpBillingDetailPage } from "@/components/cmp-billing-page";

export const instant = false;

export default async function CmpBillingDetailRoute({
  params,
}: {
  params: Promise<{ billingId: string }>;
}) {
  const { billingId } = await params;
  return <CmpBillingDetailPage billingId={billingId} />;
}
