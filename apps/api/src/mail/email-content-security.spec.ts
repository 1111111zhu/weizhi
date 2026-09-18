import { sanitizeEmailSubject } from "./email-content-security";

describe(sanitizeEmailSubject, () => {
  it("prevents user content from injecting additional mail headers", () => {
    expect(
      sanitizeEmailSubject("Audit confirmation\r\nBcc: outsider@test")
    ).toBe("Audit confirmation Bcc: outsider@test");
  });
});
