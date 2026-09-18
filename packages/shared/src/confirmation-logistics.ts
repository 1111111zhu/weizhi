type Shipment = {
  id: string;
  method?: string;
  executionStatus?: string | null;
  trackingStatus?: string | null;
  trackingNumber?: string | null;
  deliveredAt?: Date | string | null;
  trackingLastEventAt?: Date | string | null;
  trackingEvents?: unknown;
};
type Confirmation = {
  dispatches?: readonly Shipment[];
  followUpEvents?: readonly { id: string; eventType: string; payload?: unknown }[];
};
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function timestamp(value: unknown) {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function deliveryTime(shipment: Record<string, unknown>) {
  const event = Array.isArray(shipment.trackingEvents) ? shipment.trackingEvents
    .map(record).find(item => item?.stage === "Delivered" && timestamp(item.at)) : null;
  return timestamp(event?.at) ?? timestamp(shipment.deliveredAt) ?? timestamp(shipment.trackingLastEventAt);
}
export function getConfirmationLogisticsDeliveryVersion(confirmation: Confirmation): string | null {
  const deliveries: [string, string, string | null][] = [];
  for (const shipment of confirmation.dispatches ?? []) {
    if ((shipment.method === "COURIER" || shipment.method === "POST") &&
      (shipment.trackingStatus?.toLowerCase() === "delivered" || shipment.executionStatus === "DELIVERED")) {
      deliveries.push([`out:${shipment.id}`, shipment.trackingNumber ?? "", deliveryTime(shipment as unknown as Record<string, unknown>)]);
    }
  }
  for (const event of confirmation.followUpEvents ?? []) {
    if (event.eventType !== "COUNTERPARTY_SENT_RESPONSE") continue;
    const shipment = record(record(event.payload)?.returnShipment);
    if (typeof shipment?.trackingStatus !== "string" || shipment.trackingStatus.toLowerCase() !== "delivered") continue;
    deliveries.push([`return:${event.id}`, typeof shipment.trackingNumber === "string" ? shipment.trackingNumber : "", deliveryTime(shipment)]);
  }
  return deliveries.length ? JSON.stringify(deliveries.sort((a, b) => a[0].localeCompare(b[0]))) : null;
}
