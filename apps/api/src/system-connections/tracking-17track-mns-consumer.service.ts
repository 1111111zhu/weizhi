import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { HttpException, Injectable, Logger } from "@nestjs/common";

import { backgroundJobsEnabled } from "../common/background-jobs";
import { MnsQueueClient } from "./mns-queue.client";
import type { MnsQueueConfig } from "./mns-queue.client";
import {
  PermanentWebhookIngressError,
  decryptWebhookEnvelope,
} from "./tracking-17track-envelope";
import { Tracking17TrackService } from "./tracking-17track.service";

const ENV_KEYS = [
  "PROJECTWING_17TRACK_MNS_ENDPOINT",
  "PROJECTWING_17TRACK_MNS_QUEUE",
  "PROJECTWING_17TRACK_MNS_ACCESS_KEY_ID",
  "PROJECTWING_17TRACK_MNS_ACCESS_KEY_SECRET",
  "PROJECTWING_17TRACK_WEBHOOK_PRIVATE_KEY_BASE64",
] as const;

type ConsumerConfig = {
  mns: MnsQueueConfig;
  privateKeyBase64: string;
};

@Injectable()
export class Tracking17TrackMnsConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(Tracking17TrackMnsConsumer.name);
  private abortController: AbortController | null = null;
  private client: MnsQueueClient | null = null;
  private config: ConsumerConfig | null = null;
  private stopped = false;

  constructor(private readonly tracking: Tracking17TrackService) {}

  onModuleInit() {
    if (!backgroundJobsEnabled()) {
      this.logger.log(
        "17TRACK MNS consumer is disabled by the background-jobs maintenance switch"
      );
      return;
    }
    this.config = readConsumerConfig(process.env);
    if (!this.config) {
      this.logger.log("17TRACK MNS consumer is disabled");
      return;
    }
    this.client = new MnsQueueClient(this.config.mns);
    void this.consume().catch((error: unknown) => {
      this.logger.error(`17TRACK MNS consumer stopped: ${safeMessage(error)}`);
    });
  }

  onModuleDestroy() {
    this.stopped = true;
    this.abortController?.abort();
  }

  private async consume() {
    while (!this.stopped) {
      this.abortController = new AbortController();
      try {
        const message = await assertPresentValue(this.client).receiveMessage(
          this.abortController.signal
        );
        if (message) {
          await this.processMessage(message);
        }
      } catch (error) {
        if (this.stopped && isAbortError(error)) {
          return;
        }
        this.logger.error(`17TRACK MNS poll failed: ${safeMessage(error)}`);
        await delay(1000);
      }
    }
  }

  private async processMessage(message: {
    messageBody: string;
    messageId: string;
    receiptHandle: string;
  }) {
    try {
      const envelope = decryptWebhookEnvelope(
        message.messageBody,
        assertPresentValue(this.config).privateKeyBase64
      );
      await this.tracking.acceptQueuedWebhook(
        envelope.body,
        envelope.signature,
        {
          bodySha256: envelope.bodySha256,
          messageId: message.messageId,
          receivedAt: envelope.receivedAt,
          requestId: envelope.requestId,
        }
      );
      await this.deleteMessage(message.receiptHandle);
    } catch (error) {
      if (!isPermanentFailure(error)) {
        throw error;
      }
      this.logger.warn(
        `Discarding invalid 17TRACK queue message ${shortId(message.messageId)}`
      );
      await this.deleteMessage(message.receiptHandle);
    }
  }

  private deleteMessage(receiptHandle: string) {
    const signal = this.abortController?.signal ?? new AbortController().signal;
    return assertPresentValue(this.client).deleteMessage(receiptHandle, signal);
  }
}

export function readConsumerConfig(
  env: NodeJS.ProcessEnv
): ConsumerConfig | null {
  const configured = ENV_KEYS.filter((key) => Boolean(env[key]?.trim()));
  if (configured.length === 0) {
    return null;
  }
  const missing = ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Incomplete 17TRACK MNS configuration: ${missing.join(", ")}`
    );
  }
  return {
    mns: {
      accessKeyId: assertPresentValue(
        env.PROJECTWING_17TRACK_MNS_ACCESS_KEY_ID
      ).trim(),
      accessKeySecret: assertPresentValue(
        env.PROJECTWING_17TRACK_MNS_ACCESS_KEY_SECRET
      ).trim(),
      endpoint: assertPresentValue(env.PROJECTWING_17TRACK_MNS_ENDPOINT).trim(),
      queueName: assertPresentValue(env.PROJECTWING_17TRACK_MNS_QUEUE).trim(),
      waitSeconds: parseWaitSeconds(env.PROJECTWING_17TRACK_MNS_WAIT_SECONDS),
    },
    privateKeyBase64: assertPresentValue(
      env.PROJECTWING_17TRACK_WEBHOOK_PRIVATE_KEY_BASE64
    ).trim(),
  };
}

function parseWaitSeconds(value: string | undefined) {
  if (!value?.trim()) {
    return 20;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new Error("PROJECTWING_17TRACK_MNS_WAIT_SECONDS must be 1-30");
  }
  return parsed;
}

function isPermanentFailure(error: unknown) {
  if (error instanceof PermanentWebhookIngressError) {
    return true;
  }
  if (!(error instanceof HttpException)) {
    return false;
  }
  const response = error.getResponse();
  if (!isRecord(response) || typeof response.code !== "string") {
    return false;
  }
  return ["INVALID_WEBHOOK_SIGNATURE", "INVALID_WEBHOOK_PAYLOAD"].includes(
    response.code
  );
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function shortId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 12)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
