import { describe, expect, it } from "vitest";

import {
  ConnectUserMailSchema,
  CreateProjectConfirmationDispatchSchema,
} from "./index";

describe("confirmation mail contracts", () => {
  it("requires an idempotency key and complete email fields", () => {
    const result = CreateProjectConfirmationDispatchSchema.safeParse({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      method: "EMAIL",
      sentAt: "2026-07-13T10:00:00.000Z",
      recipientContact: "confirmation@bank.example",
      emailSubject: "Audit confirmation",
      emailBody: "Please review the attached confirmation.",
    });

    expect(result.success).toBeTruthy();
  });

  it("rejects incomplete or invalid email dispatches", () => {
    const result = CreateProjectConfirmationDispatchSchema.safeParse({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      method: "EMAIL",
      sentAt: "2026-07-13T10:00:00.000Z",
      recipientContact: "not-an-email",
    });

    expect(result.success).toBeFalsy();
    if (result.success) {
      throw new Error("Expected validation result to match the success branch");
    }
    expect(result.error.flatten().fieldErrors).toMatchObject({
      recipientContact: ["Valid recipient email is required"],
      emailSubject: ["Email subject is required"],
      emailBody: ["Email body is required"],
    });
  });

  it("accepts a Tencent enterprise mailbox client password", () => {
    expect(
      ConnectUserMailSchema.parse({ clientPassword: "client-specific-secret" })
    ).toStrictEqual({ clientPassword: "client-specific-secret" });
  });
});
