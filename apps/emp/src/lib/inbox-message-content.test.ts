import { describe, expect, it } from "vitest";

import type { InboxMessage } from "../api/client";
import { getDictionary } from "../i18n/dictionaries";
import { localizeInboxMessage } from "./inbox-message-content";

const baseMessage = {
  id: "message-1",
  type: "REVIEW_QUESTION",
  title: "历史标题",
  body: "历史正文",
  createdAt: "2026-08-24T08:00:00.000Z",
} satisfies InboxMessage;

describe("localized inbox message content", () => {
  it("renders the same structured message in the selected language", async () => {
    const message: InboxMessage = {
      ...baseMessage,
      contentKey: "REVIEW_QUESTION_ASSIGNED",
      contentParams: {
        actor: "Leo Li",
        paperCode: "C-01",
        paperTitle: "Cash",
        question: "Please explain the variance.",
      },
    };

    const zhCopy = await getDictionary("zh-CN");
    const enCopy = await getDictionary("en-US");
    expect(localizeInboxMessage(message, zhCopy.inbox)).toStrictEqual(
      expect.objectContaining({
        title: "复核问题待回复：C-01",
        body: "Leo Li 指派你处理底稿 C-01 Cash 的复核问题：Please explain the variance.",
      })
    );
    expect(localizeInboxMessage(message, enCopy.inbox)).toStrictEqual(
      expect.objectContaining({
        title: "Review note awaiting reply: C-01",
        body: "Leo Li assigned you a review note on C-01 Cash: Please explain the variance.",
      })
    );
  });

  it("localizes enum parameters and selects conditional templates", async () => {
    const { inbox: copy } = await getDictionary("en-US");
    const invitation = localizeInboxMessage(
      {
        ...baseMessage,
        contentKey: "PROJECT_INVITATION",
        contentParams: {
          actor: "Jony Ma",
          projectCode: "AUD-1",
          projectName: "Orchid",
          role: "PREPARER",
        },
      },
      copy
    );
    const timesheet = localizeInboxMessage(
      {
        ...baseMessage,
        contentKey: "TMS_TIMESHEET_RETURNED",
        contentParams: {
          year: 2026,
          month: 8,
          half: "SECOND_HALF",
          reason: "Missing hours",
        },
      },
      copy
    );

    expect(invitation.body).toBe("AUD-1 Orchid. Project role: Preparer.");
    expect(timesheet.body).toContain("second half");
    expect(timesheet.body).toContain("Reason: Missing hours");
  });

  it("keeps historical or incomplete messages unchanged", async () => {
    const { inbox: copy } = await getDictionary("en-US");
    expect(localizeInboxMessage(baseMessage, copy)).toBe(baseMessage);
    expect(
      localizeInboxMessage(
        {
          ...baseMessage,
          contentKey: "REVIEW_QUESTION_ASSIGNED",
          contentParams: { actor: "Leo" },
        },
        copy
      )
    ).toStrictEqual(
      expect.objectContaining({ title: "历史标题", body: "历史正文" })
    );
    expect(
      localizeInboxMessage(
        {
          ...baseMessage,
          contentKey: "PROJECT_ARCHIVE_COMPLETED",
          contentParams: {
            projectCode: "AUD-1",
            projectName: null,
            packageFileName: "archive.zip",
          },
        },
        copy
      )
    ).toStrictEqual(
      expect.objectContaining({ title: "历史标题", body: "历史正文" })
    );
  });

  it("reconstructs legacy review messages from collaboration context", async () => {
    const { inbox: copy } = await getDictionary("zh-CN");
    const localized = localizeInboxMessage(
      {
        ...baseMessage,
        sender: {
          id: "manager-1",
          name: "Leo Li",
          email: "leo@example.com",
          globalRole: "MANAGER",
        },
        workingPaper: { id: "paper-1", code: "C-01", title: "Cash" },
        reviewQuestion: {
          id: "question-1",
          status: "OPEN",
          body: "Please explain the variance.",
        },
      },
      copy
    );

    expect(localized.title).toBe(
      copy.messageTemplates.REVIEW_QUESTION_ASSIGNED.title.replace(
        "{paperCode}",
        "C-01"
      )
    );
    expect(localized.body).toBe(
      copy.messageTemplates.REVIEW_QUESTION_ASSIGNED.body
        .replace("{actor}", "Leo Li")
        .replace("{paperCode}", "C-01")
        .replace("{paperTitle}", "Cash")
        .replace("{question}", "Please explain the variance.")
    );
  });
});
