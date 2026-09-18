import { DEFAULT_WORKFLOW } from "./default-workflow";

describe("default workflow", () => {
  it("creates the three editable top-level audit phases", () => {
    expect(
      DEFAULT_WORKFLOW.map(({ code, title }) => ({ code, title }))
    ).toStrictEqual([
      { code: "1000", title: "Planning" },
      { code: "2000", title: "Execution" },
      { code: "3000", title: "Reporting" },
    ]);
    expect(DEFAULT_WORKFLOW.map((node) => node.title)).toStrictEqual([
      "Planning",
      "Execution",
      "Reporting",
    ]);
    expect(DEFAULT_WORKFLOW.every((node) => node.level === 1)).toBeTruthy();
    expect(
      DEFAULT_WORKFLOW.every((node) => node.nodeType === "PHASE")
    ).toBeTruthy();
    expect(
      DEFAULT_WORKFLOW.every((node) => !node.children?.length)
    ).toBeTruthy();
  });
});
