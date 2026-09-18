import type { RequestUser } from "../auth/request-user";
import {
  UserMailConnectionService,
  decryptCredential,
  encryptCredential,
} from "./user-mail-connection.service";

const prisma = {
  userMailConnection: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
const auditLogs = { log: vi.fn() };
const transport = {
  verify: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
};
const user: RequestUser = {
  id: "user-1",
  name: "Project Member",
  email: "member@example.test",
  globalRole: "MANAGER",
};
const source = { ipAddress: "127.0.0.1" };

function createService() {
  const service = new UserMailConnectionService(
    prisma as never,
    auditLogs as never
  );
  const mutable = service as unknown as {
    createTransport: () => typeof transport;
  };
  vi.spyOn(mutable, "createTransport").mockReturnValue(transport);
  return service;
}

describe(UserMailConnectionService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString(
      "base64"
    );
    transport.verify.mockResolvedValue(true);
    prisma.userMailConnection.upsert.mockResolvedValue({ id: "connection-1" });
  });

  afterAll(() => {
    delete process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY;
  });

  it("encrypts client passwords without storing plaintext", async () => {
    const service = createService();
    prisma.userMailConnection.findUnique.mockResolvedValue({
      provider: "WECOM_EXMAIL",
      emailAddress: user.email,
      status: "CONNECTED",
      verifiedAt: new Date(),
      lastTestedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    });

    await service.connect(user, "client-secret", source);

    expect(transport.verify).toHaveBeenCalledWith();
    const data = prisma.userMailConnection.upsert.mock.calls[0][0].create;
    expect(data.credentialCiphertext).not.toContain("client-secret");
    expect(decryptCredential(data)).toBe("client-secret");
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "USER_MAIL_CONNECTION_CONNECTED" })
    );
  });

  it("rejects credentials encrypted with a missing or invalid server key", () => {
    const credential = encryptCredential("client-secret");
    process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY = "invalid";

    expect(() => decryptCredential(credential)).toThrow("企业邮箱凭据无法解密");
  });

  it("sends the frozen PDF from the registered mailbox", async () => {
    const service = createService();
    const credential = encryptCredential("client-secret");
    prisma.userMailConnection.findUnique.mockResolvedValue({
      id: "connection-1",
      userId: user.id,
      emailAddress: user.email,
      ...credential,
    });
    transport.sendMail.mockResolvedValue({
      messageId: "<message-1@example.test>",
    });

    await expect(
      service.send(user.id, {
        html: "<p>Please review the attachment.</p>",
        to: "confirmations@bank.example",
        subject: "Audit confirmation",
        text: "Please review the attachment.",
        senderName: user.name,
        attachment: {
          fileName: "confirmation.pdf",
          content: Buffer.from("frozen-pdf"),
          contentType: "application/pdf",
        },
      })
    ).resolves.toStrictEqual({
      providerName: "WECOM_EXMAIL_SMTP",
      providerReference: "<message-1@example.test>",
      senderEmail: user.email,
    });

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: user.name, address: user.email },
        replyTo: user.email,
        to: "confirmations@bank.example",
        attachments: [
          expect.objectContaining({
            filename: "confirmation.pdf",
            content: Buffer.from("frozen-pdf"),
          }),
        ],
      })
    );
    expect(transport.close).toHaveBeenCalledWith();
  });

  it("sends an arbitrary attachment MIME without coercing it to PDF", async () => {
    const service = createService();
    const credential = encryptCredential("client-secret");
    const body = Buffer.from("opaque message bytes");
    prisma.userMailConnection.findUnique.mockResolvedValue({
      id: "connection-1",
      userId: user.id,
      emailAddress: user.email,
      ...credential,
    });
    transport.sendMail.mockResolvedValue({
      messageId: "<message-2@example.test>",
    });

    await service.send(user.id, {
      html: "<p>Please review the original attachment.</p>",
      to: "confirmations@bank.example",
      subject: "Audit confirmation",
      text: "Please review the original attachment.",
      senderName: user.name,
      attachment: {
        fileName: "evidence.msg",
        content: body,
        contentType: "application/vnd.ms-outlook",
      },
    });

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: "evidence.msg",
            content: body,
            contentType: "application/vnd.ms-outlook",
          }),
        ],
      })
    );
  });
});
