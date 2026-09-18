// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSurfaceTransition } from "./use-surface-transition";

function Harness({
  identity,
  options,
}: {
  identity: string;
  options?: Parameters<typeof useSurfaceTransition>[1];
}) {
  const ref = useSurfaceTransition<HTMLDivElement>(identity, options);
  return (
    <div ref={ref}>
      <input aria-label="draft" defaultValue="" />
    </div>
  );
}

describe("surface transition hook", () => {
  const animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
  const animate = vi.fn(() => {
    const animation = { cancel: vi.fn() };
    animations.push(animation);
    return animation;
  });
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeEach(() => {
    animate.mockClear();
    animations.length = 0;
    addEventListener.mockClear();
    removeEventListener.mockClear();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("animates content identities without running an initial transition by default", () => {
    const options = { variant: "content" as const };
    const view = render(<Harness identity="first" options={options} />);
    expect(animate).not.toHaveBeenCalled();

    act(() => view.rerender(<Harness identity="second" options={options} />));

    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 500 })
    );
  });

  it("supports reduced motion as a short opacity-only fade", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    render(
      <Harness
        identity="first"
        options={{ initial: true, variant: "content" }}
      />
    );

    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 120 })
    );
  });

  it("cancels a superseded animation while retaining child input state", () => {
    const options = { variant: "content" as const };
    const view = render(<Harness identity="first" options={options} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "draft text" } });

    act(() => view.rerender(<Harness identity="second" options={options} />));
    act(() => view.rerender(<Harness identity="third" options={options} />));

    expect(animations).toHaveLength(2);
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox")).toHaveValue("draft text");
  });

  it("uses an opacity-only page transition", () => {
    render(
      <Harness identity="first" options={{ initial: true, variant: "page" }} />
    );

    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 240 })
    );
  });

  it("animates route content while leaving the fixed header untouched", () => {
    function RouteHarness({ identity }: { identity: string }) {
      const ref = useSurfaceTransition<HTMLDivElement>(identity, {
        initial: true,
        target: "route-content",
        variant: "page",
      });
      return (
        <div ref={ref}>
          <header data-slot="project-wing-top-bar" />
          <section data-testid="route-content">Content</section>
        </div>
      );
    }

    const view = render(<RouteHarness identity="first" />);

    expect(animate).toHaveBeenCalledOnce();
    const routeContent = screen.getByTestId("route-content");
    const header = screen.getByRole("banner", { hidden: true });
    expect(animate.mock.contexts[0]).toBe(routeContent);
    expect(animate.mock.contexts[0]).not.toBe(header);

    act(() => view.rerender(<RouteHarness identity="second" />));
    expect(animate).toHaveBeenCalledTimes(2);
  });
});
