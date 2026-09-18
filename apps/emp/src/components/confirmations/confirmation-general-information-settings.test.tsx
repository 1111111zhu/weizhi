// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, afterEach, beforeEach, expect, it, vi } from "vitest";

import { ConfirmationGeneralInformationSettings } from "./confirmation-general-information-settings";

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock("../../api/client", () => ({
  api: {
    confirmationGeneralLayout: mocks.read,
    updateConfirmationGeneralLayout: mocks.save,
  },
}));
describe("confirmation behavior", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    mocks.read.mockResolvedValue({
      sections: [
        {
          id: "general",
          name: "General",
          fields: [
            {
              id: "builtin-officeDate",
              name: "Office date",
              binding: "officeDate",
            },
            { id: "custom-team", name: "Team" },
          ],
        },
      ],
    });
    mocks.save.mockClear();
    mocks.save.mockImplementation(async (value) => value);
  });
  function mount() {
    const back = vi.fn();
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <ConfirmationGeneralInformationSettings locale="en" onBack={back} />
      </QueryClientProvider>
    );
    return back;
  }

  it.each([
    {
      direction: "down",
      names: ["Office date", "MIC", "Report date", "PIC"],
      source: "MIC",
      x: 330,
      y: 240,
      expected: ["Office date", "PIC", "Report date", "MIC"],
    },
    {
      direction: "up",
      names: ["Office date", "MIC", "Report date", "PIC"],
      source: "PIC",
      x: 330,
      y: 180,
      expected: ["Office date", "PIC", "Report date", "MIC"],
    },
    {
      direction: "left",
      names: ["Office date", "Report date", "PIC", "MIC"],
      source: "MIC",
      x: 210,
      y: 250,
      expected: ["Office date", "Report date", "MIC", "PIC"],
    },
    {
      direction: "right",
      names: ["Office date", "Report date", "PIC", "MIC"],
      source: "PIC",
      x: 345,
      y: 250,
      expected: ["Office date", "Report date", "MIC", "PIC"],
    },
  ])(
    "swaps PIC and MIC $direction without shifting the dates",
    async ({ names, source, x, y, expected }) => {
      mocks.read.mockResolvedValue({
        sections: [
          {
            id: "general",
            name: "General",
            fields: names.map((name) => ({ id: name, name, colSpan: 1 })),
          },
        ],
      });
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect"
      ).mockImplementation(function elementRect(this: HTMLElement) {
        if (!this.dataset.layoutField) {
          return new DOMRect(0, 0, 600, 500);
        }
        const index = [...this.parentElement!.children].indexOf(this);
        return new DOMRect(
          (index % 2) * 300,
          100 + Math.floor(index / 2) * 120,
          260,
          100
        );
      });
      const getStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
        const style = getStyle(element);
        Object.defineProperty(style, "gridTemplateColumns", {
          configurable: true,
          value: "260px 260px",
        });
        return style;
      });
      mount();
      await screen.findByLabelText("Field name 1-1");
      const editor = screen.getByRole("region", {
        name: "General information settings",
      });
      Object.defineProperties(editor, {
        setPointerCapture: { value: vi.fn() },
        hasPointerCapture: { value: () => false },
      });
      const original = Object.getOwnPropertyDescriptor(
        document,
        "elementFromPoint"
      );
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => editor,
      });
      class TestPointerEvent extends MouseEvent {
        pointerId = 1;
      }
      vi.stubGlobal("PointerEvent", TestPointerEvent);
      let frame: FrameRequestCallback | undefined;
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
          frame = callback;
          return 1;
        }
      );
      try {
        const index = names.indexOf(source);
        fireEvent.pointerDown(
          screen.getByRole("button", { name: `Drag field: ${source}` }),
          {
            button: 0,
            clientX: (index % 2) * 300 + 30,
            clientY: 110 + Math.floor(index / 2) * 120,
          }
        );
        fireEvent.pointerMove(window, { clientX: x, clientY: y });
        act(() => frame?.(0));
        const values = () =>
          [1, 2, 3, 4].map(
            (n) =>
              (screen.getByLabelText(`Field name 1-${n}`) as HTMLInputElement)
                .value
          );
        expect(values()).toStrictEqual(expected);
        fireEvent.pointerMove(window, { clientX: x + 2, clientY: y + 2 });
        act(() => frame?.(0));
        expect(values()).toStrictEqual(expected);
        fireEvent.pointerUp(window, { clientX: x, clientY: y });
        fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
        await waitFor(() =>
          expect(mocks.save).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything()
          )
        );
        expect(
          mocks.save.mock.calls[0][0].sections[0].fields.map(
            (field: { name: string }) => field.name
          )
        ).toStrictEqual(expected);
      } finally {
        vi.unstubAllGlobals();
        if (original) {
          Object.defineProperty(document, "elementFromPoint", original);
        } else {
          Reflect.deleteProperty(document, "elementFromPoint");
        }
      }
    }
  );

  it("edits sections and built-in names, adds sections, and keeps stable bindings until apply", async () => {
    mount();
    fireEvent.change(await screen.findByLabelText("Section name 1"), {
      target: { value: "Basics" },
    });
    fireEvent.change(screen.getByLabelText("Field name 1-1"), {
      target: { value: "Issue date" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.change(screen.getByLabelText("Section name 2"), {
      target: { value: "Contacts" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add field" })[1]);
    fireEvent.change(screen.getByLabelText("Field name 2-1"), {
      target: { value: "Phone" },
    });
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        {
          sections: [
            {
              id: "general",
              name: "Basics",
              fields: [
                {
                  id: "builtin-officeDate",
                  name: "Issue date",
                  binding: "officeDate",
                },
                { id: "custom-team", name: "Team" },
              ],
            },
            {
              id: expect.any(String),
              name: "Contacts",
              fields: [{ id: expect.any(String), name: "Phone", colSpan: 1 }],
            },
          ],
        },
        expect.anything()
      )
    );
  });

  it("requires deletion confirmation and can remove any field or section", async () => {
    mount();
    await screen.findByLabelText("Field name 1-1");

    fireEvent.click(
      screen.getByRole("button", { name: "Delete field Office date" })
    );
    expect(screen.getByLabelText("Field name 1-1")).toHaveValue("Office date");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete field Office date" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByLabelText("Field name 1-1")).toHaveValue("Team");
    fireEvent.click(screen.getByRole("button", { name: "Delete section" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.queryByLabelText("Section name 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        { sections: [] },
        expect.anything()
      )
    );
  });

  it("blocks empty names and lets the user keep unsaved changes on return", async () => {
    const back = mount();
    fireEvent.change(await screen.findByLabelText("Section name 1"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter all section and field names"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Back to template library" })
    );
    expect(back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Back to template library" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("locks editing without disabling inputs or replacing the apply label while saving", async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      (value) =>
        new Promise((resolve) => {
          finish = () => resolve(value);
        })
    );
    mount();
    const name = await screen.findByLabelText("Section name 1");
    const apply = screen.getByRole("button", { name: "Apply globally" });
    fireEvent.click(apply);
    await waitFor(() => expect(apply).toHaveAttribute("aria-busy", "true"));
    expect(apply).toBeDisabled();
    expect(apply).toHaveTextContent("Apply globally");
    expect(name).toHaveAttribute("readonly");
    expect(name).not.toBeDisabled();
    await act(() => finish());
    await waitFor(() => expect(apply).toHaveAttribute("aria-busy", "false"));
    expect(name).not.toHaveAttribute("readonly");
  });

  it("does not animate scrolling as a layout move after saving a new section and field", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function elementRect(this: HTMLElement) {
        const editor = this.closest<HTMLElement>("section[aria-label]");
        return new DOMRect(0, 100 - (editor?.scrollTop ?? 0), 600, 100);
      }
    );
    mount();
    await screen.findByLabelText("Section name 1");
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    const editor = screen.getByRole("region", {
      name: "General information settings",
    });
    editor.scrollTop = 500;
    fireEvent.change(screen.getByLabelText("Section name 2"), {
      target: { value: "New section" },
    });
    const addField = screen
      .getAllByRole("button", { name: "Add field" })
      .at(-1);
    if (!addField) {throw new Error("Missing add field button");}
    fireEvent.click(addField);
    fireEvent.change(screen.getByLabelText("Field name 2-1"), {
      target: { value: "New field" },
    });
    const section = screen
      .getByLabelText("Section name 1")
      .closest("[data-layout-section]");
    if (!section) {throw new Error("Missing section");}
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(section, "animate", { value: animate });
    editor.scrollTop = 0;
    fireEvent.scroll(editor);
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    await screen.findByRole("status");
    expect(mocks.save.mock.calls[0][0].sections[1].fields[0].name).toBe(
      "New field"
    );
    expect(animate).not.toHaveBeenCalled();
  });

  it("stays in settings after applying and clears the unsaved return warning", async () => {
    const back = mount();
    fireEvent.change(await screen.findByLabelText("Section name 1"), {
      target: { value: "Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    await screen.findByRole("status");
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Section name 1")).toHaveValue("Updated");
    fireEvent.click(
      screen.getByRole("button", { name: "Back to template library" })
    );
    expect(back).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("dismisses the inline success feedback while retaining its layout space", async () => {
    mount();
    await screen.findByLabelText("Section name 1");
    const apply = screen.getByRole("button", { name: "Apply globally" });
    fireEvent.click(apply);
    const status = await screen.findByRole("status");
    const animate = vi.fn();
    Object.defineProperty(status, "animate", { value: animate });
    expect(status.parentElement).toBe(apply.parentElement);
    expect(status).toHaveClass("opacity-100");
    await waitFor(() => expect(status).toHaveAttribute("aria-hidden", "true"), {
      timeout: 4500,
    });
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("opacity-0");
    expect(animate).toHaveBeenCalledWith([{ opacity: 1 }, { opacity: 0 }], {
      duration: 200,
      easing: "ease-out",
    });
  });

  it("retains edits and reports a failed apply without navigating away", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Apply failed"));
    const back = mount();
    fireEvent.change(await screen.findByLabelText("Section name 1"), {
      target: { value: "Retained" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply globally" }));
    await screen.findByText("Apply failed");
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Section name 1")).toHaveValue("Retained");
  });

  it.each(["cancel", "drop"])(
    "animates deliberate drags even with reduced motion and cleans up after %s",
    async (ending) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        ...media,
        media: query,
        matches: query === "(prefers-reduced-motion: reduce)",
      }));
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect"
      ).mockImplementation(function elementRect(this: HTMLElement) {
        const index = this.dataset.layoutField
          ? [...this.parentElement!.children].indexOf(this)
          : 0;
        return new DOMRect(
          0,
          this.dataset.layoutField ? 100 + index * 100 : 0,
          400,
          this.dataset.layoutField ? 80 : 400
        );
      });
      const animate = vi.fn(() => ({
        cancel: vi.fn(),
        onfinish: null as (() => void) | null,
      }));
      const originalAnimate = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "animate"
      );
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: animate,
      });
      mount();
      const first = await screen.findByLabelText("Field name 1-1");
      const target = screen
        .getByLabelText("Field name 1-2")
        .closest<HTMLElement>("[data-layout-field]")!;
      const editor = first.closest<HTMLElement>("section[aria-label]")!;
      Object.defineProperties(editor, {
        setPointerCapture: { value: vi.fn() },
        hasPointerCapture: { value: () => false },
      });
      const original = Object.getOwnPropertyDescriptor(
        document,
        "elementFromPoint"
      );
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => target,
      });
      class TestPointerEvent extends MouseEvent {
        pointerId = 1;
      }
      vi.stubGlobal("PointerEvent", TestPointerEvent);
      let renderFrame: FrameRequestCallback | undefined;
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
          renderFrame = callback;
          return 1;
        }
      );
      try {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "Drag field: Office date" }),
          { button: 0, clientX: 10, clientY: 110 }
        );
        fireEvent.pointerMove(window, { clientX: 100, clientY: 215 });
        act(() => renderFrame?.(0));
        expect(screen.getByLabelText("Field name 1-1")).toHaveValue("Team");
        expect(screen.getByLabelText("Field name 1-2")).toHaveValue(
          "Office date"
        );
        expect(
          screen.queryByText("Release to place field")
        ).not.toBeInTheDocument();
        expect(
          screen.getByLabelText("Field name 1-2").closest("[data-layout-field]")
        ).toHaveClass("invisible");
        const floating = editor.querySelector<HTMLElement>(
          "[data-drag-overlay]"
        )!;
        expect(floating.querySelector("input")).toHaveValue("Office date");
        expect(floating).not.toHaveClass("invisible");
        expect(floating.style.transform).toBe("translate(90px, 105px)");
        expect(animate).toHaveBeenCalledWith(
          [
            { transform: "translate(0px, 100px)" },
            { transform: "translate(0, 0)" },
          ],
          expect.objectContaining({ duration: 240 })
        );
        expect(mocks.save).not.toHaveBeenCalled();
        fireEvent.pointerMove(window, { clientX: 100, clientY: 227 });
        act(() => renderFrame?.(0));
        expect(screen.getByLabelText("Field name 1-1")).toHaveValue("Team");
        fireEvent.pointerMove(window, { clientX: 100, clientY: 165 });
        act(() => renderFrame?.(0));
        expect(screen.getByLabelText("Field name 1-1")).toHaveValue(
          "Office date"
        );
        fireEvent.pointerMove(window, { clientX: 100, clientY: 215 });
        act(() => renderFrame?.(0));
        expect(screen.getByLabelText("Field name 1-1")).toHaveValue("Team");
        if (ending === "cancel") {
          fireEvent.keyDown(window, { key: "Escape" });
          expect(screen.getByLabelText("Field name 1-1")).toHaveValue(
            "Office date"
          );
        } else {
          fireEvent.pointerUp(window, { clientX: 100, clientY: 215 });
          expect(screen.getByLabelText("Field name 1-1")).toHaveValue("Team");
          const landing = animate.mock.results.at(-1)!.value;
          expect(landing.onfinish).toBeTypeOf("function");
          act(() => landing.onfinish?.());
          fireEvent.click(
            screen.getByRole("button", { name: "Apply globally" })
          );
          await waitFor(() =>
            expect(mocks.save).toHaveBeenCalledWith(
              expect.anything(),
              expect.anything()
            )
          );
          expect(
            mocks.save.mock.calls[0][0].sections[0].fields.map(
              (field: { name: string }) => field.name
            )
          ).toStrictEqual(["Team", "Office date"]);
        }
        expect(
          screen.queryByText("Release to place field")
        ).not.toBeInTheDocument();
        expect(editor.querySelector("[data-drag-overlay]")).toBeNull();
        expect(
          editor.querySelector("[data-layout-field].invisible")
        ).toBeNull();
      } finally {
        vi.unstubAllGlobals();
        if (original) {
          Object.defineProperty(document, "elementFromPoint", original);
        } else {
          Reflect.deleteProperty(document, "elementFromPoint");
        }
        if (originalAnimate) {
          Object.defineProperty(
            HTMLElement.prototype,
            "animate",
            originalAnimate
          );
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, "animate");
        }
      }
    }
  );
});
