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

const MANUAL_METHODS = new Set([
  "COURIER",
  "EMAIL",
  "POST",
  "HAND_DELIVERY",
  "OTHER",
]);

@Injectable()
export class ConfirmationManualChannelService implements DispatchChannel {
  getRequirements(_context: DispatchContext): ChannelRequirement[] {
    return [];
  }

  async validate(request: DispatchRequest): Promise<ValidationResult> {
    await Promise.resolve();
    if (!MANUAL_METHODS.has(request.method)) {
      return {
        ok: false,
        code: "CHANNEL_NOT_IMPLEMENTED",
        message: `Dispatch channel ${request.method} is not implemented`,
      };
    }
    return { ok: true };
  }

  async dispatch(
    request: DispatchRequest,
    idempotencyKey: string
  ): Promise<DispatchReceipt> {
    await Promise.resolve();
    return {
      providerName: "MANUAL",
      providerReference: `manual:${request.method}:${idempotencyKey.slice(0, 12)}`,
    };
  }

  async getStatus(_externalId: string): Promise<DeliveryStatus> {
    await Promise.resolve();
    return "QUEUED";
  }
}
