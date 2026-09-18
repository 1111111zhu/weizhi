import { createHmac } from "node:crypto";

const MNS_VERSION = "2015-06-06";

export type MnsQueueConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  queueName: string;
  waitSeconds: number;
};

export type MnsQueueMessage = {
  messageBody: string;
  messageId: string;
  receiptHandle: string;
};

export class MnsQueueClient {
  private readonly endpoint: string;

  constructor(private readonly config: MnsQueueConfig) {
    this.endpoint = normalizeEndpoint(config.endpoint);
  }

  async receiveMessage(signal: AbortSignal) {
    const resource = `${this.messageResource()}?waitseconds=${this.config.waitSeconds}`;
    const response = await this.request("GET", resource, signal);
    if (
      response.status === 404 &&
      xmlValue(response.body, "Code") === "MessageNotExist"
    ) {
      return null;
    }
    assertSuccess(response);
    return {
      messageBody: requiredXmlValue(response.body, "MessageBody"),
      messageId: requiredXmlValue(response.body, "MessageId"),
      receiptHandle: requiredXmlValue(response.body, "ReceiptHandle"),
    } satisfies MnsQueueMessage;
  }

  async deleteMessage(receiptHandle: string, signal: AbortSignal) {
    const resource = `${this.messageResource()}?ReceiptHandle=${encodeURIComponent(receiptHandle)}`;
    const response = await this.request("DELETE", resource, signal);
    assertSuccess(response);
  }

  private messageResource() {
    return `/queues/${encodeURIComponent(this.config.queueName)}/messages`;
  }

  private async request(
    method: "DELETE" | "GET",
    resource: string,
    signal: AbortSignal
  ) {
    const date = new Date().toUTCString();
    const canonicalHeaders = `x-mns-version:${MNS_VERSION}\n`;
    const stringToSign = `${method}\n\n\n${date}\n${canonicalHeaders}${resource}`;
    const signature = createHmac("sha1", this.config.accessKeySecret)
      .update(stringToSign)
      .digest("base64");
    const response = await fetch(`${this.endpoint}${resource}`, {
      method,
      headers: {
        Authorization: `MNS ${this.config.accessKeyId}:${signature}`,
        Date: date,
        "x-mns-version": MNS_VERSION,
      },
      signal,
    });
    return { body: await response.text(), status: response.status };
  }
}

function normalizeEndpoint(value: string) {
  const endpoint = new URL(value);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("17TRACK MNS endpoint must be an HTTPS origin");
  }
  return endpoint.origin;
}

function assertSuccess(response: { body: string; status: number }) {
  if (response.status >= 200 && response.status < 300) {
    return;
  }
  const code = xmlValue(response.body, "Code") ?? "MNS_ERROR";
  throw new Error(`MNS request failed with ${response.status} ${code}`);
}

function requiredXmlValue(xml: string, name: string) {
  const value = xmlValue(xml, name);
  if (!value) {
    throw new Error(`MNS response did not include ${name}`);
  }
  return value;
}

function xmlValue(xml: string, name: string) {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return match ? decodeXmlEntities(match[1]) : null;
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
