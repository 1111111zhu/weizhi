import { INBOX_CONTENT_KEYS } from "@project-wing/shared";

import { resolveInboxEmailPresentation } from "./inbox-email-presentation";

describe(resolveInboxEmailPresentation, () => {
  it("maps every collaboration family to a stable semantic presentation", () => {
    expect(
      resolveInboxEmailPresentation({
        contentKey: "REVIEW_QUESTION_ASSIGNED",
        contentParams: { paperCode: "C-01", paperTitle: "Cash" },
        locale: "zh-CN",
      })
    ).toMatchObject({
      actionLabel: "打开复核问题",
      eyebrow: "待办 · Review · EMP",
      facts: [{ label: "底稿", value: "C-01 · Cash" }],
      tone: "action",
    });

    expect(
      resolveInboxEmailPresentation({
        contentKey: "ATTACHMENT_CONFLICT",
        contentParams: { fileName: "audit.xlsx" },
        locale: "en-US",
      })
    ).toMatchObject({
      actionLabel: "Open project",
      eyebrow: "Attention · File versions · EMP",
      tone: "warning",
    });

    expect(
      resolveInboxEmailPresentation({
        contentKey: "PROJECT_ARCHIVE_COMPLETED",
        contentParams: {
          projectCode: "HBR-2026-ACC",
          projectName: "Harbour audit",
        },
        locale: "en-US",
      })
    ).toMatchObject({
      eyebrow: "Completed · Archive · EMP",
      tone: "success",
    });
  });

  it("provides the approved HTML-email contract for every registered content key", () => {
    for (const contentKey of INBOX_CONTENT_KEYS) {
      const presentation = resolveInboxEmailPresentation({
        contentKey,
        contentParams: null,
        locale: "zh-CN",
      });
      expect(presentation.actionLabel).toBeTruthy();
      expect(presentation.eyebrow).toContain("·");
      expect(presentation.facts).toStrictEqual([]);
      expect(["action", "neutral", "success", "warning"]).toContain(
        presentation.tone
      );
    }
  });
});
