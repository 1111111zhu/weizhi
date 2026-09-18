import { createHash, timingSafeEqual } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ConfirmationReturnShipmentSchema } from "@project-wing/shared";
import type { ConfirmationReturnShipment } from "@project-wing/shared";

import {
  ApiBadRequestException,
  ApiNotFoundException,
} from "../common/api-error";
import { decryptCredential } from "../common/credential-cipher";
import { PrismaService } from "../prisma/prisma.service";
import { Tracking17TrackCarrierDirectoryService } from "./tracking-17track-carrier-directory.service";

const PROVIDER = "TRACKING_17TRACK" as const;
const CHANGE_INFO_ENDPOINT = "https://api.17track.net/track/v2.4/changeinfo";
const GET_TRACK_INFO_ENDPOINT =
  "https://api.17track.net/track/v2.4/gettrackinfo";
const REGISTER_ENDPOINT = "https://api.17track.net/track/v2.4/register";

export type TrackingEvent = {
  at: string | null;
  description: string;
  location: string | null;
  stage: string | null;
  substatus: string | null;
};

export type Tracking17TrackSnapshot = {
  carrierName: string | null;
  description: string | null;
  events: TrackingEvent[];
  lastEventAt: Date | null;
  location: string | null;
  retrievedAt: Date;
  status: string | null;
  substatus: string | null;
};

type TrackingPayload = Record<string, unknown> & {
  carrier?: unknown;
  data?: unknown;
  event?: unknown;
  number?: unknown;
  tag?: unknown;
  track_info?: unknown;
};

type TrackingRequest = Record<
  string,
  string | number | Record<string, string> | undefined
> & {
  carrier?: number;
  number: string;
  special_tracking_info?: Record<string, string>;
  tag?: string;
};

type TrackingStore = Pick<
  Prisma.TransactionClient,
  "projectConfirmationDispatch" | "confirmationFollowUpEvent" | "systemConnection" | "webhookIngressReceipt"
>;

export type QueuedWebhookReceipt = {
  bodySha256: string;
  messageId: string;
  receivedAt: Date;
  requestId: string | null;
};

export type Tracking17TrackRegistrationResult =
  | {
      carrierCode: number | null;
      ok: true;
      registeredAt: Date;
      snapshot: Tracking17TrackSnapshot | null;
    }
  | {
      errorCode: string;
      errorMessage: string;
      ok: false;
    };

export type Tracking17TrackRefreshResult =
  | {
      ok: true;
      snapshot: Tracking17TrackSnapshot;
    }
  | {
      errorCode: string;
      errorMessage: string;
      ok: false;
    };

function toTrackingRequestParameters(parameters: Record<string, string>) {
  const request: Record<string, string> = {};
  const specialTrackingInfo: Record<string, string> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (key === "postal_code") {
      request.destination_postal_code = value;
      continue;
    }
    if (key === "number_type" || key === "parameter") {
      specialTrackingInfo[key] = value;
      continue;
    }
    request[key] = value;
  }
  if (Object.keys(specialTrackingInfo).length > 0) {
    return { ...request, special_tracking_info: specialTrackingInfo };
  }
  return request;
}

@Injectable()
export class Tracking17TrackService {
  private readonly logger = new Logger(Tracking17TrackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly carriers: Tracking17TrackCarrierDirectoryService
  ) {}

  async registerReturnShipment(
    eventId: string,
    shipment: ConfirmationReturnShipment,
    queryParameters?: Record<string, string>
  ) {
    const registration = await this.registerDispatch(
      `return:${eventId}`, shipment.trackingNumber,
      shipment.trackingCarrierCode ?? undefined, queryParameters
    );
    const event = await this.prisma.confirmationFollowUpEvent.findUniqueOrThrow({ where: { id: eventId } });
    const payload = (event.payload ?? {}) as Record<string, Prisma.InputJsonValue>;
    const existing = ConfirmationReturnShipmentSchema.safeParse(payload.returnShipment);
    const updated = { ...shipment,
      ...(registration.ok ? {
        trackingCarrierCode: registration.carrierCode,
        trackingRegisteredAt: registration.registeredAt.toISOString(),
        trackingError: null,
        ...returnShipmentSnapshot(registration.snapshot),
      } : { trackingError: registration.errorMessage }),
    };
    // A webhook may have arrived while registration was in flight.
    if (existing.success && existing.data.trackingNumber === shipment.trackingNumber &&
        Date.parse(existing.data.trackingUpdatedAt ?? "") > (Date.parse(updated.trackingUpdatedAt ?? "") || 0)) {
      Object.assign(updated, existing.data, { trackingRegisteredAt: updated.trackingRegisteredAt });
    }
    await this.prisma.confirmationFollowUpEvent.update({
      where: { id: eventId }, data: { payload: { ...payload, returnShipment: JSON.parse(JSON.stringify(updated)) } },
    });
  }

  async refreshReturnShipment(eventId: string) {
    const event = await this.prisma.confirmationFollowUpEvent.findUniqueOrThrow({ where: { id: eventId } });
    const payload = (event.payload ?? {}) as Record<string, Prisma.InputJsonValue>;
    const shipment = ConfirmationReturnShipmentSchema.parse(payload.returnShipment);
    if (!shipment.trackingRegisteredAt) {
      await this.registerReturnShipment(eventId, shipment);
      return;
    }
    const result = await this.refreshTracking(shipment.trackingNumber, shipment.trackingCarrierCode ?? undefined);
    const current = await this.prisma.confirmationFollowUpEvent.findUniqueOrThrow({ where: { id: eventId } });
    const currentPayload = (current.payload ?? {}) as Record<string, Prisma.InputJsonValue>;
    const latest = ConfirmationReturnShipmentSchema.parse(currentPayload.returnShipment);
    if (latest.trackingNumber !== shipment.trackingNumber ||
        latest.trackingUpdatedAt !== shipment.trackingUpdatedAt ||
        latest.trackingStoppedAt !== shipment.trackingStoppedAt) return;
    await this.prisma.confirmationFollowUpEvent.updateMany({
      where: { id: eventId, payload: { equals: current.payload as Prisma.InputJsonValue } },
      data: { payload: { ...currentPayload, returnShipment: {
        ...latest, ...(result.ok ? returnShipmentSnapshot(result.snapshot) : { trackingError: result.errorMessage }),
      } } },
    });
  }

  async registerDispatch(
    dispatchId: string,
    trackingNumber: string,
    carrierCode?: number,
    queryParameters?: Record<string, string>
  ): Promise<Tracking17TrackRegistrationResult> {
    const connection = await this.prisma.systemConnection.findUnique({
      where: { provider: PROVIDER },
    });
    if (!connection) {
      return {
        errorCode: "17TRACK_NOT_CONNECTED",
        errorMessage: "17TRACK 尚未连接",
        ok: false,
      };
    }

    try {
      const apiKey = decryptCredential(connection);
      const normalizedQueryParameters =
        await this.carriers.validateQueryParameters(
          carrierCode,
          queryParameters
        );
      const registration: TrackingRequest = {
        ...toTrackingRequestParameters(normalizedQueryParameters),
        number: trackingNumber,
        tag: dispatchId,
      };
      if (carrierCode) {
        registration.carrier = carrierCode;
      }
      const response = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: {
          "17token": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify([registration]),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json()) as {
        code?: number;
        data?: {
          accepted?: { carrier?: number; number?: string }[];
          rejected?: {
            carrier?: number;
            error?: { code?: number; message?: string };
            number?: string;
          }[];
        };
      };
      const accepted = payload.data?.accepted?.find(
        (item) => item.number === trackingNumber
      );
      const rejected = payload.data?.rejected?.find(
        (item) => item.number === trackingNumber
      );
      const alreadyRegistered = rejected?.error?.code === -18_019_901;
      if (
        !response.ok ||
        payload.code !== 0 ||
        (!accepted && !alreadyRegistered)
      ) {
        const errorCode =
          rejected?.error?.code ?? payload.code ?? response.status;
        return {
          errorCode: String(errorCode),
          errorMessage:
            rejected?.error?.message ??
            `17TRACK registration failed with code ${errorCode}`,
          ok: false,
        };
      }
      const resolvedCarrierCode =
        accepted?.carrier ?? rejected?.carrier ?? carrierCode ?? null;
      if (alreadyRegistered) {
        const changeResult = await this.changeRegistrationInfo(
          apiKey,
          dispatchId,
          trackingNumber,
          resolvedCarrierCode
        );
        if (!changeResult.ok) {
          return changeResult;
        }
      }
      const snapshot = await this.getTrackingSnapshot(
        apiKey,
        trackingNumber,
        resolvedCarrierCode,
        normalizedQueryParameters
      );
      return {
        carrierCode: resolvedCarrierCode,
        ok: true,
        registeredAt: new Date(),
        snapshot,
      };
    } catch (error) {
      const message = safeErrorMessage(error);
      this.logger.warn(
        `17TRACK registration failed for dispatch ${dispatchId}: ${message}`
      );
      return {
        errorCode: "17TRACK_REQUEST_FAILED",
        errorMessage: message,
        ok: false,
      };
    }
  }

  async refreshTracking(
    trackingNumber: string,
    carrierCode?: number
  ): Promise<Tracking17TrackRefreshResult> {
    const connection = await this.prisma.systemConnection.findUnique({
      where: { provider: PROVIDER },
    });
    if (!connection) {
      return {
        errorCode: "17TRACK_NOT_CONNECTED",
        errorMessage: "17TRACK 尚未连接",
        ok: false,
      };
    }

    try {
      const snapshot = await this.getTrackingSnapshot(
        decryptCredential(connection),
        trackingNumber,
        carrierCode ?? null,
        {}
      );
      if (!snapshot) {
        return {
          errorCode: "17TRACK_TRACK_INFO_UNAVAILABLE",
          errorMessage: "17TRACK 暂未返回该运单的物流信息，请稍后重试",
          ok: false,
        };
      }
      return { ok: true, snapshot };
    } catch (error) {
      const message = safeErrorMessage(error);
      this.logger.warn(
        `17TRACK refresh failed for ${trackingNumber}: ${message}`
      );
      return {
        errorCode: "17TRACK_REQUEST_FAILED",
        errorMessage: message,
        ok: false,
      };
    }
  }

  private async changeRegistrationInfo(
    apiKey: string,
    dispatchId: string,
    trackingNumber: string,
    carrierCode: number | null
  ): Promise<
    { ok: true } | { errorCode: string; errorMessage: string; ok: false }
  > {
    try {
      const change: {
        carrier?: number;
        items: { tag: string };
        number: string;
      } = { number: trackingNumber, items: { tag: dispatchId } };
      if (carrierCode) {
        change.carrier = carrierCode;
      }
      const response = await fetch(CHANGE_INFO_ENDPOINT, {
        method: "POST",
        headers: {
          "17token": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify([change]),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json()) as TrackingApiResponse;
      const accepted = payload.data?.accepted?.find(
        (item) => item.number === trackingNumber
      );
      const rejected = payload.data?.rejected?.find(
        (item) => item.number === trackingNumber
      );
      if (!response.ok || payload.code !== 0 || !accepted) {
        const errorCode =
          rejected?.error?.code ?? payload.code ?? response.status;
        return {
          errorCode: String(errorCode),
          errorMessage:
            rejected?.error?.message ??
            `17TRACK changeinfo failed with code ${errorCode}`,
          ok: false,
        };
      }
      return { ok: true };
    } catch (error) {
      return {
        errorCode: "17TRACK_CHANGE_INFO_FAILED",
        errorMessage: safeErrorMessage(error),
        ok: false,
      };
    }
  }

  private async getTrackingSnapshot(
    apiKey: string,
    trackingNumber: string,
    carrierCode: number | null,
    queryParameters: Record<string, string>
  ) {
    try {
      const query: TrackingRequest = {
        ...toTrackingRequestParameters(queryParameters),
        number: trackingNumber,
      };
      if (carrierCode) {
        query.carrier = carrierCode;
      }
      const response = await fetch(GET_TRACK_INFO_ENDPOINT, {
        method: "POST",
        headers: {
          "17token": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify([query]),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json()) as TrackingApiResponse;
      const accepted = payload.data?.accepted?.find(
        (item) => item.number === trackingNumber
      );
      if (!response.ok || payload.code !== 0 || !accepted) {
        return null;
      }
      return createTrackingSnapshot(accepted, new Date());
    } catch (error) {
      this.logger.warn(
        `17TRACK gettrackinfo failed for ${trackingNumber}: ${safeErrorMessage(error)}`
      );
      return null;
    }
  }

  async acceptWebhook(rawBody: Buffer, signature: string | undefined) {
    await Promise.resolve();
    return this.acceptWebhookWithStore(this.prisma, rawBody, signature);
  }

  acceptQueuedWebhook(
    rawBody: Buffer,
    signature: string,
    receipt: QueuedWebhookReceipt
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.webhookIngressReceipt.findUnique({
        where: { messageId: receipt.messageId },
        select: { messageId: true },
      });
      if (duplicate) {
        return { code: 200, message: "duplicate" };
      }
      const result = await this.acceptWebhookWithStore(
        transaction,
        rawBody,
        signature
      );
      await transaction.webhookIngressReceipt.create({
        data: {
          messageId: receipt.messageId,
          provider: PROVIDER,
          requestId: receipt.requestId,
          bodySha256: receipt.bodySha256,
          receivedAt: receipt.receivedAt,
        },
      });
      return result;
    });
  }

  private async acceptWebhookWithStore(
    store: TrackingStore,
    rawBody: Buffer,
    signature: string | undefined
  ) {
    const connection = await store.systemConnection.findUnique({
      where: { provider: PROVIDER },
    });
    if (!connection) {
      throw new ApiNotFoundException(
        "SYSTEM_CONNECTION_NOT_FOUND",
        "17TRACK is not connected"
      );
    }
    const apiKey = decryptCredential(connection);
    if (!signature || !verifySignature(rawBody, apiKey, signature)) {
      throw new ApiBadRequestException(
        "INVALID_WEBHOOK_SIGNATURE",
        "Invalid 17TRACK webhook signature"
      );
    }

    let payload: TrackingPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf-8")) as TrackingPayload;
    } catch {
      throw new ApiBadRequestException(
        "INVALID_WEBHOOK_PAYLOAD",
        "Invalid 17TRACK webhook payload"
      );
    }
    const event = stringOrNull(payload.event);
    const entries = extractEntries(payload.data);
    for (const entry of entries) {
      await this.applyTrackingUpdate(store, event, entry);
    }
    return { code: 200, message: "success" };
  }

  private async applyTrackingUpdate(
    store: TrackingStore,
    webhookEvent: string | null,
    payload: TrackingPayload
  ) {
    const trackingNumber = stringOrNull(payload.number);
    if (!trackingNumber) {
      return;
    }
    const carrierCode = numberOrNull(payload.carrier);
    const tag = stringOrNull(payload.tag);
    if (tag?.startsWith("return:")) {
      const event = await store.confirmationFollowUpEvent.findFirst({
        where: { id: tag.slice(7), eventType: "COUNTERPARTY_SENT_RESPONSE" },
      });
      const eventPayload = (event?.payload ?? {}) as Record<string, Prisma.InputJsonValue>;
      const shipment = ConfirmationReturnShipmentSchema.safeParse(eventPayload.returnShipment);
      if (!event || !shipment.success || shipment.data.trackingNumber !== trackingNumber) return;
      const normalized = normalizeTrackingPayload(payload);
      const updated = webhookEvent === "TRACKING_STOPPED"
        ? { trackingStoppedAt: new Date().toISOString(), trackingUpdatedAt: new Date().toISOString() }
        : returnShipmentSnapshot({
            carrierName: normalized.carrierName, status: normalized.status,
            substatus: normalized.substatus, description: normalized.latest?.description ?? null,
            location: normalized.latest?.location ?? null, lastEventAt: parseDate(normalized.latest?.at),
            retrievedAt: new Date(), events: normalized.events,
          });
      await store.confirmationFollowUpEvent.update({
        where: { id: event.id }, data: { payload: { ...eventPayload, returnShipment: { ...shipment.data, ...updated } } },
      });
      return;
    }
    const dispatch = tag
      ? await store.projectConfirmationDispatch.findFirst({
          where: { id: tag, trackingNumber },
          select: { id: true },
        })
      : await store.projectConfirmationDispatch.findFirst({
          where: {
            trackingNumber,
            method: { in: ["COURIER", "POST"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
    if (!dispatch) {
      this.logger.warn(
        `Ignoring unmatched 17TRACK webhook for ${trackingNumber}`
      );
      return;
    }

    if (webhookEvent === "TRACKING_STOPPED") {
      await store.projectConfirmationDispatch.update({
        where: { id: dispatch.id },
        data: {
          trackingProvider: "17TRACK",
          trackingCarrierCode: carrierCode,
          trackingStoppedAt: new Date(),
          trackingUpdatedAt: new Date(),
          trackingError: null,
        },
      });
      return;
    }

    const normalized = normalizeTrackingPayload(payload);
    await store.projectConfirmationDispatch.update({
      where: { id: dispatch.id },
      data: {
        trackingProvider: "17TRACK",
        trackingCarrierCode: carrierCode,
        trackingCarrierName: normalized.carrierName,
        trackingStatus: normalized.status,
        trackingSubstatus: normalized.substatus,
        trackingDescription: normalized.latest?.description ?? null,
        trackingLocation: normalized.latest?.location ?? null,
        trackingEvents: normalized.events as Prisma.InputJsonValue,
        trackingLastEventAt: parseDate(normalized.latest?.at),
        trackingUpdatedAt: new Date(),
        trackingStoppedAt: null,
        trackingError: null,
        executionStatus:
          normalized.status === "Delivered" ? "DELIVERED" : undefined,
        deliveredAt:
          normalized.status === "Delivered"
            ? (parseDate(normalized.latest?.at) ?? new Date())
            : undefined,
      },
    });
  }
}

type TrackingApiResponse = {
  code?: number;
  data?: {
    accepted?: (TrackingPayload & { carrier?: number; number?: string })[];
    rejected?: {
      carrier?: number;
      error?: { code?: number; message?: string };
      number?: string;
    }[];
  };
};

function extractEntries(value: unknown): TrackingPayload[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as TrackingPayload[];
  }
  if (!isRecord(value)) {
    return [];
  }
  if (Array.isArray(value.accepted)) {
    return value.accepted.filter(isRecord) as TrackingPayload[];
  }
  return [value as TrackingPayload];
}

function normalizeTrackingPayload(payload: TrackingPayload) {
  const trackInfo = isRecord(payload.track_info) ? payload.track_info : {};
  const latestStatus = isRecord(trackInfo.latest_status)
    ? trackInfo.latest_status
    : {};
  const providers =
    isRecord(trackInfo.tracking) && Array.isArray(trackInfo.tracking.providers)
      ? trackInfo.tracking.providers
      : [];
  const primaryProvider = providers.find(isRecord);
  const events = providers
    .flatMap((provider) =>
      isRecord(provider) && Array.isArray(provider.events)
        ? provider.events
        : []
    )
    .filter(isRecord)
    .map(normalizeEvent)
    .filter((event): event is TrackingEvent => Boolean(event.description))
    .sort((left, right) => dateValue(right.at) - dateValue(left.at));
  const latestEvent = isRecord(trackInfo.latest_event)
    ? normalizeEvent(trackInfo.latest_event)
    : null;
  const latest = latestEvent?.description ? latestEvent : (events[0] ?? null);
  return {
    status: stringOrNull(latestStatus.status),
    substatus: stringOrNull(latestStatus.sub_status),
    carrierName:
      primaryProvider && isRecord(primaryProvider.provider)
        ? stringOrNull(primaryProvider.provider.name)
        : null,
    latest,
    events: deduplicateEvents(events).slice(0, 100),
  };
}

function createTrackingSnapshot(
  payload: TrackingPayload,
  retrievedAt: Date
): Tracking17TrackSnapshot {
  const normalized = normalizeTrackingPayload(payload);
  return {
    carrierName: normalized.carrierName,
    description: normalized.latest?.description ?? null,
    events: normalized.events,
    lastEventAt: parseDate(normalized.latest?.at),
    location: normalized.latest?.location ?? null,
    retrievedAt,
    status: normalized.status,
    substatus: normalized.substatus,
  };
}

function normalizeEvent(value: Record<string, unknown>): TrackingEvent {
  const translation = isRecord(value.description_translation)
    ? value.description_translation
    : {};
  return {
    at: stringOrNull(value.time_utc) ?? stringOrNull(value.time_iso),
    description:
      stringOrNull(translation.description) ??
      stringOrNull(value.description) ??
      "",
    location: stringOrNull(value.location),
    stage: stringOrNull(value.stage),
    substatus: stringOrNull(value.sub_status),
  };
}

function deduplicateEvents(events: TrackingEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.at ?? ""}|${event.description}|${event.location ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function verifySignature(rawBody: Buffer, apiKey: string, signature: string) {
  const expected = createHash("sha256")
    .update(rawBody)
    .update("/")
    .update(apiKey)
    .digest("hex");
  const provided = signature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: string | null) {
  return parseDate(value)?.getTime() ?? 0;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown 17TRACK error";
}

function returnShipmentSnapshot(snapshot: Tracking17TrackSnapshot | null) {
  if (!snapshot) return {};
  return {
    trackingCarrierName: snapshot.carrierName, trackingStatus: snapshot.status,
    trackingDescription: snapshot.description, trackingLocation: snapshot.location,
    trackingLastEventAt: snapshot.lastEventAt?.toISOString() ?? null,
    trackingUpdatedAt: snapshot.retrievedAt.toISOString(), trackingEvents: snapshot.events,
    trackingError: null, trackingStoppedAt: null,
    ...(snapshot.status === "Delivered" ? { deliveredAt: (snapshot.lastEventAt ?? snapshot.retrievedAt).toISOString() } : {}),
  };
}
