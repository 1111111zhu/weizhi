import { expect, it } from "vitest";
import { getConfirmationLogisticsDeliveryVersion as version } from "./confirmation-logistics";
const shipment = { id: "out-1", method: "COURIER", trackingStatus: "Delivered", trackingNumber: "N1", deliveredAt: "2026-09-14T08:30:00Z" };
it("normalizes dates and ignores in-transit shipments", () => {
  expect(version({ dispatches: [shipment] })).toBe(version({ dispatches: [{ ...shipment, deliveredAt: new Date(shipment.deliveredAt) }] }));
  expect(version({ dispatches: [{ ...shipment, trackingStatus: "InTransit" }] })).toBeNull();
});
it("changes when another shipment is delivered", () => {
  const first = version({ dispatches: [shipment] });
  expect(version({ dispatches: [{ ...shipment, trackingNumber: "N2" }] })).not.toBe(first);
  expect(version({ dispatches: [shipment], followUpEvents: [{ id: "in-1", eventType: "COUNTERPARTY_SENT_RESPONSE", payload: { returnShipment: { trackingStatus: "Delivered", trackingNumber: "R1", deliveredAt: shipment.deliveredAt } } }] })).not.toBe(first);
});
