import { createProjectCode, nextProjectSequence } from "./project-code";

describe("project code helpers", () => {
  it("formats yearly audit project codes with a four digit sequence", () => {
    expect(createProjectCode(2026, 1)).toBe("AUD-2026-0001");
    expect(createProjectCode(2026, 42)).toBe("AUD-2026-0042");
  });

  it("calculates the next sequence for the requested year only", () => {
    expect(
      nextProjectSequence(
        ["AUD-2025-0009", "AUD-2026-0001", "AUD-2026-0003"],
        2026
      )
    ).toBe(4);
  });
});
