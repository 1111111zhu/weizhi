import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
// @vitest-environment happy-dom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./toast";

const sonnerMocks = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  });

  return {
    toast,
    Toaster: vi.fn((props: { position?: string }) =>
      createElement("div", {
        "data-position": props.position,
        "data-testid": "toaster",
      })
    ),
  };
});

vi.mock("sonner", () => sonnerMocks);
const navigation = vi.hoisted(() => ({ pathname: "/zh-CN/confirmations" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe(ToastProvider, () => {
    it("keeps the requested timeout and action, and dismisses only scoped notices on navigation", () => {
      sonnerMocks.toast.success.mockReturnValue("matched-response");
      const view = render(<ToastProvider><ScopedToastHarness /></ToastProvider>);
      fireEvent.click(screen.getByRole("button", { name: "Matched" }));
      expect(sonnerMocks.toast.success).toHaveBeenCalledWith("Matched", expect.objectContaining({
        duration: 5000,
        closeButton: true,
        action: expect.objectContaining({ label: "Go to confirmation" }),
      }));
      navigation.pathname = "/zh-CN/engagement/project-1";
      view.rerender(<ToastProvider><ScopedToastHarness /></ToastProvider>);
      expect(sonnerMocks.toast.dismiss).toHaveBeenCalledWith("matched-response");
      navigation.pathname = "/zh-CN/confirmations";
    });
    it("routes non-confirm notifications through Sonner", () => {
      render(
        createElement(
          ToastProvider,
          null,
          createElement(ToastHarness, { onConfirm: vi.fn() })
        )
      );

      fireEvent.click(screen.getByRole("button", { name: "Show toast" }));

      expect(screen.getByTestId("toaster")).toBeTruthy();
      expect(screen.getByTestId("toaster").dataset.position).toBe("top-center");
      expect(sonnerMocks.toast.success).toHaveBeenCalledWith(
        "保存成功",
        expect.objectContaining({ description: "已更新项目。" })
      );
    });

    it("uses a blurred Dialog for confirmations", async () => {
      const onConfirm = vi.fn();
      render(
        createElement(
          ToastProvider,
          null,
          createElement(ToastHarness, { onConfirm })
        )
      );

      fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));

      await expect(screen.findByText("确认删除项目")).resolves.toBeTruthy();
      expect(
        [...document.querySelectorAll("[class]")].some((element) =>
          element.className.toString().includes("backdrop-blur-[2px]")
        )
      ).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

      await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(true));
    });

    it("sanitizes technical error descriptions before sending them to Sonner", () => {
      render(
        createElement(ToastProvider, null, createElement(ErrorToastHarness))
      );

      fireEvent.click(screen.getByRole("button", { name: "Show error" }));

      expect(sonnerMocks.toast.error).toHaveBeenCalledWith(
        "Request failed",
        expect.objectContaining({
          description:
            "Network connection failed. Check your connection and try again.",
        })
      );
      expect(sonnerMocks.toast.error).not.toHaveBeenCalledWith(
        "Request failed",
        expect.objectContaining({ description: "Failed to fetch" })
      );
    });

    it("keeps long confirmation details in a keyboard-focusable region", async () => {
      const description = Array.from(
        { length: 50 },
        (_, index) => `Audit project ${index}`
      ).join("\n");
      render(
        createElement(
          ToastProvider,
          null,
          createElement(ToastHarness, { onConfirm: vi.fn(), description })
        )
      );
      fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));
      const details = await screen.findByRole("region", {
        name: "确认删除项目",
      });
      expect(details).toHaveAttribute("tabindex", "0");
      expect(details).toHaveTextContent("Audit project 49");
    });
  });

  function ToastHarness({
    onConfirm,
    description = "删除后项目会从工作台归档隐藏。",
  }: {
    onConfirm: (value: boolean) => void;
    description?: string;
  }) {
    const { toast, confirm } = useToast();

    return (
      <div>
        <button
          type="button"
          onClick={() =>
            toast({
              title: "保存成功",
              description: "已更新项目。",
              variant: "success",
            })
          }
        >
          Show toast
        </button>
        <button
          type="button"
          onClick={() => {
            void confirm({
              title: "确认删除项目",
              description,
              confirmLabel: "确认删除",
            }).then(onConfirm);
          }}
        >
          Open confirm
        </button>
      </div>
    );
  }

  function ErrorToastHarness() {
    const { toast } = useToast();
    return (
      <button
        type="button"
        onClick={() =>
          toast({
            title: "Request failed",
            description: "Failed to fetch",
            variant: "destructive",
          })
        }
      >
        Show error
      </button>
    );
  }

  function ScopedToastHarness() {
    const { toast } = useToast();
    return <button type="button" onClick={() => toast({
      title: "Matched", variant: "success", duration: 5000,
      closeButton: true, dismissOnNavigation: true,
      actions: [{ label: "Go to confirmation", onClick: vi.fn() }],
    })}>Matched</button>;
  }
});
