import { createHash } from "node:crypto";

import type { Mock } from "vitest";

import { encryptCredential } from "../common/credential-cipher";
import { Tracking17TrackService } from "./tracking-17track.service";

const prisma = {
  confirmationFollowUpEvent: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  systemConnection: {
    findUnique: vi.fn(),
  },
  projectConfirmationDispatch: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  webhookIngressReceipt: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};
const carriers = {
  validateQueryParameters: vi.fn(),
};

type FetchMock = {
  mockResolvedValue: (value: unknown) => FetchMock;
  mockResolvedValueOnce: (value: unknown) => FetchMock;
};

function fetchMock() {
  return vi.spyOn(global, "fetch") as unknown as FetchMock;
}

describe(Tracking17TrackService, () => {
  const apiKey = "seventeen-track-api-key";
  const service = new Tracking17TrackService(
    prisma as never,
    carriers as never
  );

  beforeEach(() => {
    vi.clearAllMocks();
    carriers.validateQueryParameters.mockResolvedValue({});
    process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString(
      "base64"
    );
    prisma.systemConnection.findUnique.mockResolvedValue({
      id: "connection-1",
      provider: "TRACKING_17TRACK",
      ...encryptCredential(apiKey),
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
    });
    prisma.projectConfirmationDispatch.update.mockResolvedValue({
      id: "dispatch-1",
    });
    prisma.webhookIngressReceipt.findUnique.mockResolvedValue(null);
    prisma.webhookIngressReceipt.create.mockResolvedValue({ messageId: "m-1" });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  afterAll(() => {
    delete process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY;
  });

  it("registers a physical dispatch once with its dispatch id as the tag", async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [{ number: "SF123456", carrier: 100_003 }],
              rejected: [],
            },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [trackingDetails("SF123456", "dispatch-1")],
              rejected: [],
            },
          };
        },
      });

    await expect(
      service.registerDispatch("dispatch-1", "SF123456", 191_222)
    ).resolves.toStrictEqual({
      carrierCode: 100_003,
      ok: true,
      registeredAt: expect.any(Date),
      snapshot: expect.objectContaining({
        carrierName: "SF Express",
        description: "Delivered to recipient",
        status: "Delivered",
        events: expect.arrayContaining([
          expect.objectContaining({ description: "In transit" }),
        ]),
      }),
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.17track.net/track/v2.4/register",
      expect.objectContaining({
        headers: expect.objectContaining({ "17token": apiKey }),
        body: JSON.stringify([
          { number: "SF123456", tag: "dispatch-1", carrier: 191_222 },
        ]),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.17track.net/track/v2.4/gettrackinfo",
      expect.objectContaining({
        body: JSON.stringify([{ number: "SF123456", carrier: 100_003 }]),
      })
    );
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
  });

  it("refreshes an already registered shipment from gettrackinfo", async () => {
    fetchMock().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          code: 0,
          data: {
            accepted: [trackingDetails("SF123456", "dispatch-1")],
            rejected: [],
          },
        }),
    });

    await expect(
      service.refreshTracking("SF123456", 100_003)
    ).resolves.toStrictEqual({
      ok: true,
      snapshot: expect.objectContaining({
        carrierName: "SF Express",
        description: "Delivered to recipient",
        status: "Delivered",
        events: expect.arrayContaining([
          expect.objectContaining({ description: "In transit" }),
        ]),
      }),
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.17track.net/track/v2.4/gettrackinfo",
      expect.objectContaining({
        body: JSON.stringify([{ number: "SF123456", carrier: 100_003 }]),
      })
    );
  });

  it("reports an unavailable tracking snapshot without mutating a dispatch", async () => {
    fetchMock().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ code: 0, data: { accepted: [], rejected: [] } }),
    });

    await expect(
      service.refreshTracking("SF123456", 100_003)
    ).resolves.toStrictEqual({
      errorCode: "17TRACK_TRACK_INFO_UNAVAILABLE",
      errorMessage: "17TRACK 暂未返回该运单的物流信息，请稍后重试",
      ok: false,
    });
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
  });

  it("forwards carrier query details to registration and the initial lookup", async () => {
    carriers.validateQueryParameters.mockResolvedValue({
      phone_number_last_4: "1234",
    });
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: { accepted: [{ number: "SF123456", carrier: 190_766 }] },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: { accepted: [trackingDetails("SF123456", "dispatch-1")] },
          };
        },
      });

    await service.registerDispatch("dispatch-1", "SF123456", 190_766, {
      phone_number_last_4: "1234",
    });

    expect(carriers.validateQueryParameters).toHaveBeenCalledWith(190_766, {
      phone_number_last_4: "1234",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.17track.net/track/v2.4/register",
      expect.any(Object)
    );
    expect(JSON.parse((fetch as Mock).mock.calls[0][1].body)).toStrictEqual([
      expect.objectContaining({
        carrier: 190_766,
        number: "SF123456",
        phone_number_last_4: "1234",
        tag: "dispatch-1",
      }),
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.17track.net/track/v2.4/gettrackinfo",
      expect.any(Object)
    );
    expect(JSON.parse((fetch as Mock).mock.calls[1][1].body)).toStrictEqual([
      expect.objectContaining({
        carrier: 190_766,
        number: "SF123456",
        phone_number_last_4: "1234",
      }),
    ]);
  });

  it("rebinds an already registered number before reading its details", async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [],
              rejected: [
                {
                  carrier: 191_222,
                  number: "R26062747635767",
                  error: { code: -18_019_901, message: "Already registered" },
                },
              ],
            },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [{ number: "R26062747635767", carrier: 191_222 }],
              rejected: [],
            },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [
                trackingDetails("R26062747635767", "dispatch-current"),
              ],
              rejected: [],
            },
          };
        },
      });

    await expect(
      service.registerDispatch("dispatch-current", "R26062747635767", 191_222)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        carrierCode: 191_222,
        ok: true,
        snapshot: expect.objectContaining({ status: "Delivered" }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.17track.net/track/v2.4/changeinfo",
      expect.objectContaining({
        body: JSON.stringify([
          {
            number: "R26062747635767",
            items: { tag: "dispatch-current" },
            carrier: 191_222,
          },
        ]),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.17track.net/track/v2.4/gettrackinfo",
      expect.any(Object)
    );
  });

  it("rejects a duplicate registration when its dispatch tag cannot be rebound", async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [],
              rejected: [
                {
                  carrier: 191_222,
                  number: "R26062747635767",
                  error: { code: -18_019_901, message: "Already registered" },
                },
              ],
            },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          await Promise.resolve();
          return {
            code: 0,
            data: {
              accepted: [],
              rejected: [
                {
                  carrier: 191_222,
                  number: "R26062747635767",
                  error: { code: -18_019_902, message: "Tracking not found" },
                },
              ],
            },
          };
        },
      });

    await expect(
      service.registerDispatch("dispatch-current", "R26062747635767", 191_222)
    ).resolves.toStrictEqual({
      errorCode: "-18019902",
      errorMessage: "Tracking not found",
      ok: false,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns a registration failure without marking the dispatch as sent", async () => {
    fetchMock().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        await Promise.resolve();
        return {
          code: 0,
          data: {
            accepted: [],
            rejected: [
              {
                number: "R26062747635767",
                error: {
                  code: -18_019_903,
                  message: "Carrier cannot be detected",
                },
              },
            ],
          },
        };
      },
    });

    await expect(
      service.registerDispatch("dispatch-1", "R26062747635767")
    ).resolves.toStrictEqual({
      errorCode: "-18019903",
      errorMessage: "Carrier cannot be detected",
      ok: false,
    });
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
  });

  it("verifies a webhook and stores only the shipment status and event timeline", async () => {
    const body = Buffer.from(
      JSON.stringify({
        event: "TRACKING_UPDATED",
        data: {
          number: "SF123456",
          tag: "dispatch-1",
          carrier: 100_003,
          track_info: {
            latest_status: {
              status: "Delivered",
              sub_status: "Delivered_Other",
            },
            latest_event: {
              time_utc: "2026-07-15T04:30:00Z",
              description: "Delivered to recipient",
              location: "Hong Kong",
            },
            tracking: {
              providers: [
                {
                  provider: { name: "SF Express" },
                  events: [
                    {
                      time_utc: "2026-07-15T04:30:00Z",
                      description: "Delivered to recipient",
                      location: "Hong Kong",
                    },
                    {
                      time_utc: "2026-07-14T09:00:00Z",
                      description: "In transit",
                      location: "Shenzhen",
                    },
                  ],
                },
              ],
            },
          },
        },
      })
    );
    const signature = createHash("sha256")
      .update(body)
      .update("/")
      .update(apiKey)
      .digest("hex");

    await service.acceptWebhook(body, signature);

    expect(prisma.projectConfirmationDispatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-1", trackingNumber: "SF123456" },
      })
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-1" },
        data: expect.objectContaining({
          trackingCarrierName: "SF Express",
          trackingStatus: "Delivered",
          trackingDescription: "Delivered to recipient",
          trackingLocation: "Hong Kong",
          executionStatus: "DELIVERED",
          trackingEvents: expect.arrayContaining([
            expect.objectContaining({ description: "In transit" }),
          ]),
        }),
      })
    );
  });

  it("updates an incoming shipment on later delivery without touching the outgoing dispatch", async () => {
    prisma.confirmationFollowUpEvent.findFirst.mockResolvedValue({
      id: "incoming-1", payload: { returnShipment: { trackingNumber: "RETURN-1" } },
    });
    const body = Buffer.from(JSON.stringify({ event: "TRACKING_UPDATED", data: {
      number: "RETURN-1", tag: "return:incoming-1", carrier: 100003,
      track_info: { latest_status: { status: "Delivered" }, latest_event: {
        time_utc: "2026-09-14T08:30:00Z", description: "Delivered",
      } },
    } }));
    const signature = createHash("sha256").update(body).update("/").update(apiKey).digest("hex");
    await service.acceptWebhook(body, signature);
    await service.acceptWebhook(body, signature);
    expect(prisma.confirmationFollowUpEvent.update).toHaveBeenLastCalledWith({
      where: { id: "incoming-1" }, data: { payload: { returnShipment: expect.objectContaining({
        trackingStatus: "Delivered", deliveredAt: "2026-09-14T08:30:00.000Z",
      }) } },
    });
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
    prisma.confirmationFollowUpEvent.findFirst.mockResolvedValue({
      id: "incoming-1", payload: { returnShipment: { trackingNumber: "OTHER" } },
    });
    prisma.confirmationFollowUpEvent.update.mockClear();
    await service.acceptWebhook(body, signature);
    expect(prisma.confirmationFollowUpEvent.update).not.toHaveBeenCalled();
  });

  it("preserves return shipment registration when tracking provider fails", async () => {
    prisma.confirmationFollowUpEvent.findUniqueOrThrow.mockResolvedValue({
      id: "incoming-1", payload: { returnShipment: { trackingNumber: "RETURN-1" } },
    });
    prisma.systemConnection.findUnique.mockResolvedValue(null);
    await service.registerReturnShipment("incoming-1", { trackingNumber: "RETURN-1" });
    expect(prisma.confirmationFollowUpEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { payload: { returnShipment: expect.objectContaining({ trackingNumber: "RETURN-1", trackingError: "17TRACK 尚未连接" }) } },
    }));
  });

  it("rejects webhooks with an invalid signature", async () => {
    const body = Buffer.from(JSON.stringify({ event: "TRACKING_UPDATED" }));

    await expect(service.acceptWebhook(body, "0".repeat(64))).rejects.toThrow(
      "Invalid 17TRACK webhook signature"
    );
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
  });

  it("stores a queue receipt atomically after processing", async () => {
    const body = Buffer.from(JSON.stringify({ data: [] }));
    const signature = createHash("sha256")
      .update(body)
      .update("/")
      .update(apiKey)
      .digest("hex");

    await service.acceptQueuedWebhook(body, signature, {
      bodySha256: createHash("sha256").update(body).digest("hex"),
      messageId: "m-1",
      receivedAt: new Date("2026-07-15T09:00:00Z"),
      requestId: "request-1",
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.webhookIngressReceipt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ messageId: "m-1" }),
    });
  });

  it("does not process a duplicate queue message", async () => {
    prisma.webhookIngressReceipt.findUnique.mockResolvedValue({
      messageId: "m-1",
    });

    await expect(
      service.acceptQueuedWebhook(Buffer.from("{}"), "a".repeat(64), {
        bodySha256: "b".repeat(64),
        messageId: "m-1",
        receivedAt: new Date(),
        requestId: null,
      })
    ).resolves.toStrictEqual({ code: 200, message: "duplicate" });
    expect(prisma.systemConnection.findUnique).not.toHaveBeenCalled();
    expect(prisma.webhookIngressReceipt.create).not.toHaveBeenCalled();
  });
});

function trackingDetails(number: string, tag: string) {
  return {
    number,
    tag,
    carrier: 100_003,
    track_info: {
      latest_status: {
        status: "Delivered",
        sub_status: "Delivered_Other",
      },
      latest_event: {
        time_utc: "2026-07-15T04:30:00Z",
        description: "Delivered to recipient",
        location: "Hong Kong",
      },
      tracking: {
        providers: [
          {
            provider: { name: "SF Express" },
            events: [
              {
                time_utc: "2026-07-15T04:30:00Z",
                description: "Delivered to recipient",
                location: "Hong Kong",
              },
              {
                time_utc: "2026-07-14T09:00:00Z",
                description: "In transit",
                location: "Shenzhen",
              },
            ],
          },
        ],
      },
    },
  };
}
