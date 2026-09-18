import { describe, expect, it } from "vitest";

import { readLoginFormValues } from "./login-form";

describe(readLoginFormValues, () => {
  it("prefers the current named control values", () => {
    const form = createForm({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });

    expect(
      readLoginFormValues(form, {
        email: "stale@example.com",
        password: "stale-password",
      })
    ).toStrictEqual({
      email: "partner@projectwing.local",
      password: "Partner123!",
    });
  });

  it("falls back to component state when a named control is unavailable", () => {
    expect(
      readLoginFormValues(createForm({}), {
        email: "saved@example.com",
        password: "saved-password",
      })
    ).toStrictEqual({
      email: "saved@example.com",
      password: "saved-password",
    });
  });
});

function createForm(values: Partial<Record<"email" | "password", string>>) {
  return {
    elements: {
      namedItem(name: string) {
        return name in values
          ? { value: values[name as "email" | "password"] }
          : null;
      },
    },
  };
}
