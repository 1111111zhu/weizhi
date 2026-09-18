import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendInboxActionSearchParam,
  appendInboxReviewQuestionActionParams,
  resolveInboxActionHref,
} from "./inbox-action-url";

const localizedPath = vi.fn((pathname: string) => `/zh-CN${pathname}`);

describe(resolveInboxActionHref, () => {
  beforeEach(() => localizedPath.mockClear());

  it("opens local CMP notifications in the CMP development app", () => {
    expect(
      resolveInboxActionHref(
        "/cmp/acceptance?tab=approvals&requestId=request-1",
        localizedPath,
        { hostname: "localhost" }
      )
    ).toBe(
      "http://localhost:3002/zh-CN/acceptance?tab=approvals&requestId=request-1"
    );
    expect(localizedPath).toHaveBeenCalledWith(
      "/acceptance?tab=approvals&requestId=request-1"
    );
  });

  it("opens CMP notifications on the matching SuperFX deployment", () => {
    expect(
      resolveInboxActionHref(
        "/cmp/acceptance?requestId=request-2",
        localizedPath,
        {
          hostname: "emp.superfx.cn",
        }
      )
    ).toBe("https://cmp.superfx.cn/zh-CN/acceptance?requestId=request-2");
  });

  it("opens CMP notifications on the matching WZCPA deployment", () => {
    expect(
      resolveInboxActionHref(
        "/cmp/acceptance?requestId=request-3",
        localizedPath,
        {
          domainSuffix: "wzcpa.hk",
        }
      )
    ).toBe("https://cmp.wzcpa.hk/zh-CN/acceptance?requestId=request-3");
  });

  it("keeps the compiled deployment origin stable during hydration", () => {
    expect(
      resolveInboxActionHref("/cmp/acceptance", localizedPath, {
        hostname: "localhost",
        domainSuffix: "superfx.cn",
      })
    ).toBe("https://cmp.superfx.cn/zh-CN/acceptance");
  });

  it("keeps ordinary EMP notifications inside the current locale", () => {
    expect(
      resolveInboxActionHref("/engagement/project-1", localizedPath, {
        hostname: "emp.superfx.cn",
      })
    ).toBe("/zh-CN/engagement/project-1");
    expect(localizedPath).toHaveBeenCalledWith("/engagement/project-1");
  });

  it("opens legacy project notifications in the engagement workspace", () => {
    expect(
      resolveInboxActionHref(
        "/projects/project-1?workspace=confirmations",
        localizedPath,
        { hostname: "emp.superfx.cn" }
      )
    ).toBe("/zh-CN/engagement/project-1?workspace=confirmations");
    expect(localizedPath).toHaveBeenCalledWith(
      "/engagement/project-1?workspace=confirmations"
    );
  });

  it("merges search parameters without creating a second query marker", () => {
    expect(
      appendInboxActionSearchParam(
        "/cmp/acceptance?tab=requests&requestId=request-1",
        "reviewQuestionId",
        "question-1"
      )
    ).toBe(
      "/cmp/acceptance?tab=requests&requestId=request-1&reviewQuestionId=question-1"
    );
  });

  it("adds the complete read-only SmartForm preview target", () => {
    const result = appendInboxReviewQuestionActionParams(
      "/engagement/project-1",
      {
        reviewQuestionId: "question-1",
        attachmentId: "smart-form-1",
        smartFormNodeId: "section-1",
        smartFormRowId: "row-4",
        smartFormTargetLabel: "Procedure 4",
      }
    );
    const url = new URL(result, "https://emp.superfx.cn");

    expect(Object.fromEntries(url.searchParams)).toStrictEqual({
      reviewQuestionId: "question-1",
      attachmentId: "smart-form-1",
      smartFormPreview: "1",
      smartFormNodeId: "section-1",
      smartFormRowId: "row-4",
      smartFormTargetLabel: "Procedure 4",
      focus: "q",
    });
  });
});
