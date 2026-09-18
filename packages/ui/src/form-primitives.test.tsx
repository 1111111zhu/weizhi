// @vitest-environment happy-dom
import { act, createRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateTimeInput } from "./date-time-input";
import { Field } from "./field";
import { FileUpload } from "./file-upload";
import { Input } from "./input";
import { Progress } from "./progress";
import { SelectionCard } from "./selection-card";
import { Textarea } from "./textarea";

function required<T extends Element>(host: ParentNode, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing ${selector}`);
  }
  return element;
}

describe("shared form value and accessibility contracts", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("associates labels and validation, preserves external descriptions and distinguishes readonly from disabled", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const ref = createRef<HTMLInputElement>();
    try {
      act(() =>
        root.render(
          <Field
            label="Name"
            id="name"
            descriptionId="existing-help"
            description="Recorded name"
            error="Name required"
            required
            readOnly
          >
            {(control) => (
              <Input {...control} ref={ref} id="name" defaultValue="Alice" />
            )}
          </Field>
        )
      );
      const input = required<HTMLInputElement>(host, "input");
      expect(ref.current).toBe(input);
      expect(input.getAttribute("aria-labelledby")).toBe("name-label");
      expect(input.getAttribute("aria-describedby")).toBe(
        "existing-help name-description name-error"
      );
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.readOnly === true).toBeTruthy();
      expect(input.disabled === false).toBeTruthy();
      act(() => input.focus());
      expect(document.activeElement).toBe(input);
      act(() =>
        root.render(
          <Field label="Name" id="name" disabled>
            {(control) => <Input {...control} id="name" defaultValue="Alice" />}
          </Field>
        )
      );
      expect(input.disabled === true).toBeTruthy();
      expect(host.querySelector('[role="alert"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("forwards textarea refs and keeps local date strings unchanged through native form data", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const ref = createRef<HTMLTextAreaElement>();
    const changed = vi.fn();
    try {
      act(() =>
        root.render(
          <form>
            <Field label="Memo">
              {(control) => (
                <Textarea
                  {...control}
                  ref={ref}
                  name="memo"
                  defaultValue={"Draft\nSecond line"}
                />
              )}
            </Field>
            <Field label="Local date and time">
              {(control) => (
                <DateTimeInput
                  {...control}
                  name="date"
                  mode="date-time"
                  value="2026-09-13T12:30"
                  onValueChange={changed}
                />
              )}
            </Field>
          </form>
        )
      );
      expect(ref.current).toBe(host.querySelector("textarea"));
      const data = new FormData(required<HTMLFormElement>(host, "form"));
      expect(data.get("memo")).toBe("Draft\nSecond line");
      expect(data.get("date")).toBe("2026-09-13T12:30");
      expect(changed).toHaveBeenCalledTimes(0);
    } finally {
      act(() => root.unmount());
    }
  });

  it("emits chosen files, exposes progress and blocks duplicate changes during upload", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const changed = vi.fn();
    const file = new File(["synthetic"], "example.txt", { type: "text/plain" });
    try {
      act(() =>
        root.render(
          <FileUpload
            label="Evidence"
            accept=".txt"
            multiple
            onFilesChange={changed}
          />
        )
      );
      const input = required<HTMLInputElement>(host, 'input[type="file"]');
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
      expect(changed).toHaveBeenCalledExactlyOnceWith([file]);
      act(() =>
        root.render(
          <FileUpload
            label="Evidence"
            loading
            progress={40}
            onFilesChange={changed}
          />
        )
      );
      expect(input.disabled === true).toBeTruthy();
      expect(input.getAttribute("aria-busy")).toBe("true");
      expect(required<HTMLProgressElement>(host, "progress").value).toBe(40);
      act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
    }
  });

  it("keeps card selection controlled and ignores activation while disabled", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const changed = vi.fn();
    function Harness({ disabled = false }: { disabled?: boolean }) {
      const [selected, setSelected] = useState(false);
      return (
        <SelectionCard
          label="Option"
          selected={selected}
          disabled={disabled}
          onSelectedChange={(next) => {
            changed(next);
            setSelected(next);
          }}
        />
      );
    }
    try {
      act(() => root.render(<Harness />));
      const button = required<HTMLButtonElement>(host, "button");
      act(() => button.click());
      expect(changed).toHaveBeenCalledExactlyOnceWith(true);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      act(() => root.render(<Harness disabled />));
      act(() => button.click());
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
    }
  });

  it("bounds determinate progress and does not invent progress for invalid values", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      act(() => root.render(<Progress label="Work" value={200} />));
      expect(required<HTMLProgressElement>(host, "progress").value).toBe(100);
      act(() => root.render(<Progress label="Work" value={Number.NaN} />));
      expect(
        required<HTMLProgressElement>(host, "progress").hasAttribute(
          "value"
        ) === false
      ).toBeTruthy();
    } finally {
      act(() => root.unmount());
    }
  });
});
