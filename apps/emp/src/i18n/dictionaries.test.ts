import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";

describe("eMP Chinese dictionary", () => {
  it("localizes project review-question statuses", async () => {
    const dictionary = await getDictionary("zh-CN");

    expect(dictionary.projects.reviewQuestions.statusLabels).toStrictEqual({
      OPEN: "未关闭",
      REPLIED: "已回复",
      CLEARED: "已关闭",
    });
  });

  it("uses a concise confirmation action for response handling", async () => {
    const dictionary = await getDictionary("zh-CN");

    expect(dictionary.confirmations.reviewResolution.submit).toBe("确定");
  });

  it("uses concise Chinese labels for template batch actions", async () => {
    const dictionary = await getDictionary("zh-CN");

    expect(dictionary.confirmations.templateLibrary).toStrictEqual(
      expect.objectContaining({
        deleteSelected: "删除",
        enableSelected: "启用",
        disableSelected: "停用",
      })
    );
  });

  it("localizes the review-note composer and conversation actions", async () => {
    const chinese = await getDictionary("zh-CN");
    const english = await getDictionary("en-US");

    expect(chinese.workbench.reviewQuestions).toStrictEqual(
      expect.objectContaining({
        dialogTitle: "注释 / 复核注释",
        newReviewNote: "新建复核注释",
        emptyTitle: "暂无复核注释",
        createPlaceholder: "请描述需要补充或更正的内容",
        assignRespondent: "指派回复人",
        addReviewNote: "添加复核注释",
        send: "发送",
        projectRoleLabels: expect.objectContaining({
          REVIEWER: "复核人",
          PREPARER: "编制人",
        }),
      })
    );
    expect(english.workbench.reviewQuestions).toStrictEqual(
      expect.objectContaining({
        dialogTitle: "Notes / Review notes",
        newReviewNote: "New review note",
        addReviewNote: "Add review note",
      })
    );
  });

  it("does not assume a dispatch number in the redispatch request event", async () => {
    const dictionary = await getDictionary("zh-CN");

    expect(
      dictionary.confirmations.tracking.followUp.eventLabels
        .REDISPATCH_REQUESTED
    ).toBe("对方要求重新发函");
  });

  it("provides selection-mode labels for confirmation lifecycle actions", async () => {
    const chinese = await getDictionary("zh-CN");
    const english = await getDictionary("en-US");

    expect(chinese.confirmations.register).toStrictEqual(
      expect.objectContaining({
        deleteMode: "删除函证",
        deleteSelected: "删除选中函证",
        restoreMode: "还原函证",
        restoreSelected: "还原选中函证",
        selectionColumn: "选择函证",
        selectRow: "选择函证：{name}",
      })
    );
    expect(english.confirmations.register).toStrictEqual(
      expect.objectContaining({
        deleteMode: "Delete confirmations",
        deleteSelected: "Delete selected confirmations",
        restoreMode: "Restore confirmations",
        restoreSelected: "Restore selected confirmations",
        selectionColumn: "Select confirmations",
        selectRow: "Select confirmation: {name}",
      })
    );
  });
});

describe("eMP confirmation review dictionary", () => {
  it("uses Confirm for the English response handling action", async () => {
    const dictionary = await getDictionary("en-US");

    expect(dictionary.confirmations.reviewResolution.submit).toBe("Confirm");
  });

  it("contains typed copy for project-scoped confirmation imports", async () => {
    const dictionary = await getDictionary("en-US");

    expect(
      dictionary.confirmationCenter.intranet.responseWarehousePanel
    ).toStrictEqual(
      expect.objectContaining({
        title: "Archive to project",
        grouped: "Create folder",
        zip: "Combine as ZIP",
        eligible: "Eligible",
        imported: "Imported",
        blocked: "Blocked",
      })
    );
  });

  it("generalizes new confirmation uploads while preserving response and template restrictions", async () => {
    const english = await getDictionary("en-US");
    const chinese = await getDictionary("zh-CN");

    expect(english.confirmations.newConfirmationDialog.uploadDocument).toBe(
      "Upload confirmation file"
    );
    expect(english.confirmations.newConfirmationDialog.fileHelp).toMatch(
      /any non-empty file/i
    );
    expect(chinese.confirmations.newConfirmationDialog.uploadDocument).toBe(
      "上传函证文件"
    );
    expect(chinese.confirmations.newConfirmationDialog.fileHelp).toContain(
      "任意非空格式"
    );
    expect(english.confirmations.tracking.responseScanHelp).toContain(
      "PDF, JPG, or PNG"
    );
    expect(english.confirmations.templateLibrary.uploadDescription).toContain(
      "PDF"
    );
  });
});
