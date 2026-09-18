// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { StatefulMotionButton } from "./stateful-motion-button";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe(StatefulMotionButton, () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("remeasures the label when the state text becomes longer", async () => {
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const width = (this.textContent?.length ?? 0) * 10;
        return {
          bottom: 0,
          height: 16,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StatefulMotionButton state="idle" errorText="保存失败">
          已保存
        </StatefulMotionButton>
      );
    });
    expect(measure).toHaveBeenCalled();
    measure.mockClear();

    await act(async () => {
      root.render(
        <StatefulMotionButton state="error" errorText="保存失败">
          已保存
        </StatefulMotionButton>
      );
    });

    expect(measure).toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
