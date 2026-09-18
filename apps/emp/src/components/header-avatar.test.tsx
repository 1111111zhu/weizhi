import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// @vitest-environment happy-dom

import {
  HeaderAvatar,
  getAvatarColorClassName,
  getAvatarInitials,
} from "./header-avatar";

describe(HeaderAvatar, () => {
  it("renders initials from a full name", () => {
    render(<HeaderAvatar label="Current account" name="jony ma" />);

    const avatar = screen.getByRole("img", { name: "Current account" });
    expect(avatar).toBeTruthy();
  });

  it("falls back to email local-part initials", () => {
    expect(getAvatarInitials("senior.manager@projectwing.local")).toBe("SM");
  });

  it("keeps the generated color stable for the same name", () => {
    expect(getAvatarColorClassName("jony ma")).toBe(
      getAvatarColorClassName("jony ma")
    );
    expect(getAvatarColorClassName("jony ma")).not.toBe(
      getAvatarColorClassName("manager li")
    );
  });
});
