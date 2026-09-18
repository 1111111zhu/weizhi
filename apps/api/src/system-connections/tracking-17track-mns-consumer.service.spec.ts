import {
  Tracking17TrackMnsConsumer,
  readConsumerConfig,
} from "./tracking-17track-mns-consumer.service";

describe(Tracking17TrackMnsConsumer, () => {
  it("does not start or validate the consumer while background jobs are disabled", () => {
    vi.stubEnv("PROJECTWING_BACKGROUND_JOBS_ENABLED", "false");
    vi.stubEnv("PROJECTWING_17TRACK_MNS_QUEUE", "incomplete-config");
    vi.stubEnv("PROJECTWING_17TRACK_MNS_ENDPOINT", "");
    vi.stubEnv("PROJECTWING_17TRACK_MNS_ACCESS_KEY_ID", "");
    vi.stubEnv("PROJECTWING_17TRACK_MNS_ACCESS_KEY_SECRET", "");
    vi.stubEnv("PROJECTWING_17TRACK_WEBHOOK_PRIVATE_KEY_BASE64", "");
    try {
      const consumer = new Tracking17TrackMnsConsumer({} as never);
      expect(() => consumer.onModuleInit()).not.toThrow();
      consumer.onModuleDestroy();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe(readConsumerConfig, () => {
  it("keeps the consumer disabled when no values are set", () => {
    expect(readConsumerConfig({})).toBeNull();
  });

  it("requires the complete secret set", () => {
    expect(() =>
      readConsumerConfig({ PROJECTWING_17TRACK_MNS_QUEUE: "queue" })
    ).toThrow("Incomplete 17TRACK MNS configuration");
  });

  it("builds a bounded long-poll configuration", () => {
    expect(
      readConsumerConfig({
        PROJECTWING_17TRACK_MNS_ENDPOINT: "https://example.com",
        PROJECTWING_17TRACK_MNS_QUEUE: "queue",
        PROJECTWING_17TRACK_MNS_ACCESS_KEY_ID: "access-key",
        PROJECTWING_17TRACK_MNS_ACCESS_KEY_SECRET: "access-secret",
        PROJECTWING_17TRACK_WEBHOOK_PRIVATE_KEY_BASE64: "private-key",
        PROJECTWING_17TRACK_MNS_WAIT_SECONDS: "30",
      })
    ).toStrictEqual({
      mns: {
        accessKeyId: "access-key",
        accessKeySecret: "access-secret",
        endpoint: "https://example.com",
        queueName: "queue",
        waitSeconds: 30,
      },
      privateKeyBase64: "private-key",
    });
  });
});
