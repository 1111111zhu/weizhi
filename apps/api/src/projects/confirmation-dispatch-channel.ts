import type { ConfirmationDispatchMethod } from "@prisma/client";

export type DispatchContext = {
  artifactId: string;
  confirmationId: string;
  confirmationCode: string | null;
  counterpartyName: string;
  projectId: string;
};

export type ChannelRequirement = {
  code: string;
  required: boolean;
};

export type DispatchRequest = DispatchContext & {
  method: ConfirmationDispatchMethod;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type DispatchReceipt = {
  providerName: string;
  providerReference: string | null;
  courierName?: string | null;
  dispatchReference?: string | null;
  trackingNumber?: string | null;
};

export type DeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

export interface DispatchChannel {
  getRequirements: (context: DispatchContext) => ChannelRequirement[];
  validate: (request: DispatchRequest) => Promise<ValidationResult>;
  dispatch: (
    request: DispatchRequest,
    idempotencyKey: string
  ) => Promise<DispatchReceipt>;
  getStatus: (externalId: string) => Promise<DeliveryStatus>;
  cancel?: (externalId: string) => Promise<void>;
}
