import { describe, expect, it } from "vitest";

import {
  decodeMobileState,
  advanceMobileTrail,
  effectiveFolder,
  emptyMobileState,
  initialMobileRoute,
  mobileFileKey,
  mobileFiles,
  mobileQuestionKey,
  mobileRouteHref,
  moveMobileFiles,
  parseMobileRoute,
  sendMobileReply,
  mobileDocumentProfile,
  mobileProcedureResultOptions,
  shouldRevealMobileReply,
} from "./mobile-workspace-model";

describe("mobile productivity specimen state", () => {
  it("ignores the retired project filter while preserving search and drafts", () => {
    const state = emptyMobileState();
    state.search = "Orchid";
    state.drafts["orchid:cash-program:q1"] = "Keep draft";
    const decoded = decodeMobileState(
      JSON.stringify({ ...state, onlyOpen: true })
    );
    expect(decoded).not.toHaveProperty("onlyOpen");
    expect(decoded.search).toBe("Orchid");
    expect(decoded.drafts).toStrictEqual(state.drafts);
  });

  it("offers result values appropriate to the procedure and preserves its current value", () => {
    expect(
      mobileProcedureResultOptions({ id: "risk", result: "已识别" })
    ).toStrictEqual(["已识别", "待补充", "不适用"]);
    expect(
      mobileProcedureResultOptions({ id: "confirmation", result: "已取得" })
    ).toStrictEqual(["已取得", "未取得", "待补充", "不适用"]);
  });

  it.each(mobileFiles)(
    "uses valid, scoped reference and question data for $id",
    (file) => {
      const profile = mobileDocumentProfile(file);
      expect(profile.questions).toHaveLength(file.questions);
      expect(
        mobileFiles.some((reference) => reference.id === profile.referenceId)
      ).toBeTruthy();
      expect(
        profile.referenceId !== file.id || file.questions === 0
      ).toBeTruthy();
    }
  );

  it("does not reuse bank questions and procedures for planning or receivables", () => {
    const planning = mobileFiles.find((file) => file.id === "planning");
    const receivables = mobileFiles.find(
      (file) => file.id === "receivable-program"
    );
    if (!planning || !receivables) {
      throw new Error("Missing scoped fixtures");
    }
    expect(mobileDocumentProfile(planning).referenceId).toBe("planning-risk");
    expect(
      mobileDocumentProfile(planning).procedures.map((row) => row.id)
    ).toStrictEqual(["materiality", "risk", "resources"]);
    expect(mobileDocumentProfile(receivables).referenceId).toBe(
      "receivable-aging"
    );
    expect(
      mobileDocumentProfile(receivables).procedures.map((row) => row.id)
    ).toStrictEqual(["ledger", "aging", "collection"]);
  });

  it("reveals only a newly sent local reply in the same question", () => {
    const pending = {
      questionKey: "orchid:cash-program:q1",
      id: "new-message",
    };
    expect(
      shouldRevealMobileReply(pending, pending.questionKey, [
        { id: pending.id },
      ])
    ).toBeTruthy();
    expect(
      shouldRevealMobileReply(null, pending.questionKey, [{ id: pending.id }])
    ).toBeFalsy();
    expect(
      shouldRevealMobileReply(pending, "orchid:cash-program:q2", [
        { id: pending.id },
      ])
    ).toBeFalsy();
    expect(
      shouldRevealMobileReply(pending, pending.questionKey, [
        { id: "old-message" },
      ])
    ).toBeFalsy();
  });

  it("does not turn the server's default view into a phantom back entry during hydration", () => {
    const empty = { entries: [], index: 0 };
    expect(
      advanceMobileTrail(empty, "#projects", "#files?project=harbour")
    ).toBe(empty);
    expect(
      advanceMobileTrail(
        empty,
        "#files?project=harbour",
        "#files?project=harbour"
      )
    ).toStrictEqual({ entries: ["#files?project=harbour"], index: 0 });
  });

  it("tracks backward and forward traversal without duplicating entries", () => {
    const before = {
      entries: ["#projects", "#files?project=harbour"],
      index: 1,
    };
    const back = advanceMobileTrail(before, "#projects", "#projects");
    expect(back).toStrictEqual({ ...before, index: 0 });
    expect(
      advanceMobileTrail(
        back,
        "#files?project=harbour",
        "#files?project=harbour"
      )
    ).toStrictEqual(before);
  });

  it("round-trips exact project, document, mode and question context", () => {
    const route = {
      ...initialMobileRoute,
      screen: "document" as const,
      project: "harbour",
      file: "cash-program",
      mode: "notes" as const,
      question: "q2",
    };
    expect(parseMobileRoute(mobileRouteHref(route))).toStrictEqual(route);
  });

  it("keeps legacy specimen links usable", () => {
    expect(parseMobileRoute("#notes")).toMatchObject({
      screen: "document",
      mode: "notes",
      question: "q1",
    });
    expect(parseMobileRoute("#attachment")).toMatchObject({
      screen: "document",
      file: "bank-reply",
    });
  });

  it("normalizes invalid targets and does not offer a fake PDF editor", () => {
    expect(parseMobileRoute("#document?file=unknown")).toMatchObject({
      screen: "files",
      folder: "",
    });
    expect(
      parseMobileRoute("#document?file=bank-reply&mode=edit&q=q1")
    ).toMatchObject({ mode: "read", question: "" });
  });

  it("isolates replies by project, document and question and clears only the sent draft", () => {
    const route = {
      ...initialMobileRoute,
      screen: "document" as const,
      mode: "notes" as const,
      question: "q1",
    };
    const key = mobileQuestionKey(route);
    const other = mobileQuestionKey({ ...route, question: "q2" });
    const state = emptyMobileState();
    state.drafts[key] = "First\nSecond";
    state.drafts[other] = "Unsent";
    const next = sendMobileReply(state, route, "message-1");
    expect(next.replies[key]).toStrictEqual([
      { id: "message-1", text: "First\nSecond" },
    ]);
    expect(next.drafts[key]).toBe("");
    expect(next.drafts[other]).toBe(state.drafts[other]);
    expect(
      next.replies[mobileQuestionKey({ ...route, project: "harbour" })]
    ).toBeUndefined();
  });

  it("does not send an empty draft or attach a message to a nonexistent question", () => {
    const state = emptyMobileState();
    const route = { ...initialMobileRoute, question: "q3", file: "bank-reply" };
    expect(sendMobileReply(state, initialMobileRoute, "id")).toBe(state);
    state.drafts[mobileQuestionKey(route)] = "Invalid target";
    expect(sendMobileReply(state, route, "id")).toBe(state);
  });

  it("moves only selected files actually in the source folder and current project", () => {
    const state = emptyMobileState();
    const moved = moveMobileFiles(state, "orchid", "cash", "receivables", [
      "bank-reply",
      "planning",
    ]);
    expect(moved.folders[mobileFileKey("orchid", "bank-reply")]).toBe(
      "receivables"
    );
    expect(moved.folders[mobileFileKey("orchid", "planning")]).toBeUndefined();
    expect(
      moved.folders[mobileFileKey("harbour", "bank-reply")]
    ).toBeUndefined();
    const file = mobileFiles.find((item) => item.id === "bank-reply");
    if (!file) {
      throw new Error("Missing fixture");
    }
    expect(effectiveFolder(moved, "orchid", file)).toBe("receivables");
    expect(effectiveFolder(state, "orchid", file)).toBe("cash");
  });

  it("rejects invalid destinations without changing file placement", () => {
    const state = emptyMobileState();
    expect(
      moveMobileFiles(state, "orchid", "cash", "unknown", ["bank-reply"])
    ).toBe(state);
  });

  it("restores valid drafts, scroll positions and unsaved edits; corrupt storage fails safely", () => {
    const state = emptyMobileState();
    state.drafts["orchid:cash-program:q1"] = "Draft";
    state.editDrafts["orchid:cash-program"] = { balance: "一致" };
    state.scroll["#projects"] = 220;
    expect(decodeMobileState(JSON.stringify(state))).toStrictEqual(state);
    expect(decodeMobileState("{bad-json")).toStrictEqual(emptyMobileState());
    expect(
      decodeMobileState(JSON.stringify({ ...state, version: 99 }))
    ).toStrictEqual(emptyMobileState());
  });
});
