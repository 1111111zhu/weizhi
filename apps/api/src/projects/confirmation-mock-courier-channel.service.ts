import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type {
  ChannelRequirement,
  DeliveryStatus,
  DispatchChannel,
  DispatchContext,
  DispatchReceipt,
  DispatchRequest,
  ValidationResult,
} from "./confirmation-dispatch-channel";

export type MockCourierMode = "ORDER" | "PICKUP";

@Injectable()
export class ConfirmationMockCourierChannelService implements DispatchChannel {
  getRequirements(_context: DispatchContext): ChannelRequirement[] {
    return [];
  }

  async validate(request: DispatchRequest): Promise<ValidationResult> {
    await Promise.resolve();
    if (request.method !== "COURIER") {
      return {
        ok: false,
        code: "CHANNEL_NOT_IMPLEMENTED",
        message: `Mock courier only supports COURIER dispatches, received ${request.method}`,
      };
    }
    return { ok: true };
  }

  async dispatch(
    request: DispatchRequest,
    idempotencyKey: string,
    mode: MockCourierMode = "ORDER"
  ): Promise<DispatchReceipt> {
    await Promise.resolve();
    const suffix = createHash("sha256")
      .update(`${request.confirmationId}:${idempotencyKey}`)
      .digest("hex")
      .slice(0, 12)
      .toUpperCase();
    const trackingNumber = `MOCK${suffix}`;
    const operation = mode === "PICKUP" ? "pickup" : "order";

    return {
      providerName: "MOCK_COURIER",
      providerReference: `mock-courier:${operation}:${suffix}`,
      courierName: "Mock Courier",
      dispatchReference:
        mode === "PICKUP"
          ? `Mock pickup scheduled for ${request.counterpartyName}`
          : `Mock courier order created for ${request.counterpartyName}`,
      trackingNumber,
    };
  }

  async getStatus(_externalId: string): Promise<DeliveryStatus> {
    await Promise.resolve();
    return "SENT";
  }
}
