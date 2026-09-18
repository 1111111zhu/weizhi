import { createHmac } from "node:crypto";

import { MnsQueueClient } from "./mns-queue.client";

const config = {
  accessKeyId: "test-access-key",
  accessKeySecret: "test-access-secret",
  endpoint: "https://1234.mns.cn-shenzhen-internal.aliyuncs.com",
  queueName: "projectwing-17track",
  waitSeconds: 20,
};

describe(MnsQueueClient, () => {
  beforeEach(() => vi.restoreAllMocks());

  it("signs and parses a long-poll response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      response(
        200,
        "<Message><MessageId>message-1</MessageId>" +
          "<ReceiptHandle>receipt&amp;1</ReceiptHandle>" +
          "<MessageBody>ZW52ZWxvcGU=</MessageBody></Message>"
      )
    );
    const client = new MnsQueueClient(config);

    await expect(
      client.receiveMessage(new AbortController().signal)
    ).resolves.toStrictEqual({
      messageBody: "ZW52ZWxvcGU=",
      messageId: "message-1",
      receiptHandle: "receipt&1",
    });

    expectSignedRequest(
      "GET",
      "/queues/projectwing-17track/messages?waitseconds=20"
    );
  });

  it("treats MessageNotExist as an empty poll", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      response(404, "<Error><Code>MessageNotExist</Code></Error>")
    );
    const client = new MnsQueueClient(config);

    await expect(
      client.receiveMessage(new AbortController().signal)
    ).resolves.toBeNull();
  });

  it("uRL-encodes and signs a receipt handle when deleting", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(response(204, ""));
    const client = new MnsQueueClient(config);

    await client.deleteMessage("receipt+/=", new AbortController().signal);

    expectSignedRequest(
      "DELETE",
      "/queues/projectwing-17track/messages?ReceiptHandle=receipt%2B%2F%3D"
    );
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});

function expectSignedRequest(method: string, resource: string) {
  const fetchMock = vi.mocked(global.fetch);
  const [[url, init]] = fetchMock.mock.calls;
  const headers = init?.headers as Record<string, string>;
  const signature = createHmac("sha1", config.accessKeySecret)
    .update(
      `${method}\n\n\n${headers.Date}\n` +
        `x-mns-version:2015-06-06\n${resource}`
    )
    .digest("base64");
  expect(url).toBe(`${config.endpoint}${resource}`);
  expect(headers.Authorization).toBe(`MNS ${config.accessKeyId}:${signature}`);
}

function response(status: number, body: string) {
  return {
    status,
    text: async () => {
      await Promise.resolve();
      return body;
    },
  } as unknown as Response;
}
