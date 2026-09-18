import { describe, expect, it } from "vitest";

import type { InboxMessage } from "../api/client";
import { getCmpDictionary } from "../i18n/client";
import { localizeCmpInboxMessage } from "./inbox-message-content";

const baseMessage = {
  id: "message-1",
  recipientId: "user-1",
  senderId: null,
  type: "SYSTEM_NOTIFICATION",
  title: "原始标题",
  body: "原始正文",
  actionUrl: "/cmp/acceptance?requestId=request-1",
  readAt: null,
  createdAt: "2026-08-25T08:00:00.000Z",
} satisfies InboxMessage;

describe("localized CMP inbox message content", () => {
  it("renders the same approval request in the selected language", () => {
    const message: InboxMessage = {
      ...baseMessage,
      contentKey: "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
      contentParams: {
        requestNo: "CA-001",
        actor: "Leo Li",
        acceptanceType: "CLIENT",
        subject: "Orchid Holdings",
        step: "PIC",
      },
    };

    expect(
      localizeCmpInboxMessage(message, getCmpDictionary("zh-CN").shell)
    ).toStrictEqual(
      expect.objectContaining({
        title: "CA-001 等待你进行 PIC 审批",
        body: "Leo Li 提交了客户准入：Orchid Holdings。当前步骤：PIC 审批。",
      })
    );
    expect(
      localizeCmpInboxMessage(message, getCmpDictionary("en-US").shell)
    ).toStrictEqual(
      expect.objectContaining({
        title: "CA-001 is awaiting your PIC approval",
        body: "Leo Li submitted Client Acceptance: Orchid Holdings. Current step: PIC approval.",
      })
    );
  });

  it("localizes a return without a reason in the selected language", () => {
    const copy = getCmpDictionary("en-US").shell;
    const message: InboxMessage = {
      ...baseMessage,
      contentKey: "CMP_ACCEPTANCE_RETURNED",
      contentParams: {
        requestNo: "CA-001",
        actor: "Leo Li",
        acceptanceType: "CLIENT",
        subject: "Orchid Holdings",
        reason: null,
      },
    };

    expect(localizeCmpInboxMessage(message, copy)).toStrictEqual(
      expect.objectContaining({
        title: "CA-001 returned",
        body: "Leo Li returned Client Acceptance: Orchid Holdings. No reason was provided.",
      })
    );
    expect(
      localizeCmpInboxMessage(message, getCmpDictionary("zh-CN").shell)
    ).toStrictEqual(
      expect.objectContaining({
        title: "CA-001 已被退回",
        body: "Leo Li 退回了客户准入：Orchid Holdings。未填写退回原因。",
      })
    );
  });

  it("keeps unknown and incomplete messages unchanged", () => {
    const copy = getCmpDictionary("en-US").shell;
    expect(localizeCmpInboxMessage(baseMessage, copy)).toBe(baseMessage);
    expect(
      localizeCmpInboxMessage(
        {
          ...baseMessage,
          contentKey: "CMP_ACCEPTANCE_RETURNED",
          contentParams: {
            requestNo: "CA-001",
            acceptanceType: "CLIENT",
            subject: "Orchid Holdings",
            reason: null,
          },
        },
        copy
      )
    ).toStrictEqual(
      expect.objectContaining({ title: "原始标题", body: "原始正文" })
    );
  });
});
