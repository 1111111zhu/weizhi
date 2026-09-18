import { getProjectWingTopBarAvatarTone } from "@project-wing/ui";
import { describe, expect, it } from "vitest";
// @vitest-environment happy-dom

describe("projectWingTopBarAvatar", () => {
  it("matches Microsoft's Fluent Persona color samples", () => {
    expect(getProjectWingTopBarAvatarTone("Kat Larrson")).toBe(4);
    expect(getProjectWingTopBarAvatarTone("Annie Lindqvist")).toBe(3);
  });

  it("uses the Microsoft blue fallback when the name is empty", () => {
    expect(getProjectWingTopBarAvatarTone("")).toBe(1);
  });
});
