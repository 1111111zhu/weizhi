// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  GuidedForm,
  GuidedFormIntro,
  GuidedFormEntryActions,
  GuidedFormChoices,
  GuidedFormField,
  GuidedFormSection,
  GuidedFormSelect,
  GuidedFormSummary,
} from "./guided-form";
import { Input } from "./input";

function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test value to be present");
  }
  return value;
}

describe("guided form accessibility and workflow contracts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses explicit entry activation rather than selecting a radio on focus", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const activate = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.append(container);
    try {
      await act(() =>
        root.render(
          <GuidedFormEntryActions
            label="Entry"
            onAction={activate}
            options={[
              { value: "regular", label: "Regular" },
              { value: "quick", label: "Quick" },
              { value: "disabled", label: "Unavailable", disabled: true },
            ]}
          />
        )
      );
      const buttons = container.querySelectorAll("button");
      await act(() => buttons[1].focus());
      expect(activate).not.toHaveBeenCalled();
      expect(container.querySelector('input[type="radio"]')).toBeNull();
      await act(() => buttons[1].click());
      expect(activate).toHaveBeenCalledExactlyOnceWith("quick");
      await act(() => buttons[2].click());
      expect(activate).toHaveBeenCalledOnce();
      expect(buttons[0].type).toBe("button");
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });

  it("keeps the introductory identity and progression actions caller-owned", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const quick = vi.fn();
    const proceed = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(
          <GuidedFormIntro
            title="Jony Ma，开始工作吧"
            description="选择业务以继续"
            actions={
              <Button disabled onClick={proceed}>
                下一步
              </Button>
            }
            alternative={<Button onClick={quick}>快速创建</Button>}
          >
            <Input aria-label="搜索业务" />
          </GuidedFormIntro>
        )
      );
      expect(container.querySelector("h1")?.textContent).toBe(
        "Jony Ma，开始工作吧"
      );
      expect(container.querySelector("nav")).toBeNull();
      const buttons = container.querySelectorAll("button");
      await act(() => buttons[0].click());
      expect(proceed).not.toHaveBeenCalled();
      expect(quick).not.toHaveBeenCalled();
      await act(() => buttons[1].click());
      expect(quick).toHaveBeenCalledOnce();
    } finally {
      await act(() => root.unmount());
    }
  });

  it("searches name and code without changing selection, supports clearing the query and selecting a result", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const changed = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    function Fixture() {
      const [value, setValue] = useState("sme");
      return (
        <GuidedFormField id="search-template" label="Template">
          {(control) => (
            <GuidedFormSelect
              {...control}
              value={value}
              onValueChange={(next) => {
                setValue(next);
                changed(next);
              }}
              placeholder="Choose template"
              options={[
                { value: "sme", label: "SME 模板", code: "AUD_TEMPLATE1" },
                { value: "hk", label: "Hong Kong", code: "HK02" },
                {
                  value: "disabled",
                  label: "Unavailable",
                  code: "HK03",
                  disabled: true,
                },
              ]}
              search={{
                placeholder: "Search templates",
                groupLabel: "Templates",
                emptyLabel: "No results",
                clearLabel: "Clear search",
                clearSelectionLabel: "Clear selected template",
              }}
            />
          )}
        </GuidedFormField>
      );
    }
    const editSearch = async (value: string) => {
      const input = requireValue(
        document.querySelector<HTMLInputElement>('input[role="combobox"]')
      );
      await act(() => {
        requireValue(
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
            ?.set
        ).call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    try {
      await act(() => root.render(<Fixture />));
      const trigger = requireValue(
        container.querySelector<HTMLInputElement>("#search-template")
      );
      expect(trigger.value).toBe("SME 模板");
      await act(() => trigger.focus());
      expect(document.querySelectorAll('input[role="combobox"]')).toHaveLength(
        1
      );
      expect(document.querySelector('[role="dialog"] input')).toBeNull();
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
      expect(
        document.querySelector('[role="option"][aria-disabled="true"]')
          ?.textContent
      ).toContain("Unavailable");
      await editSearch(" HK02 ");
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(1);
      expect(document.querySelector('[role="option"]')?.textContent).toContain(
        "Hong Kong"
      );
      expect(changed).not.toHaveBeenCalled();
      await editSearch("no-match");
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
      expect(document.querySelector("output")?.textContent).toBe("No results");
      expect(trigger.value).toBe("no-match");
      await act(() =>
        requireValue(
          document.querySelector<HTMLButtonElement>(
            '[aria-label="Clear search"]'
          )
        ).click()
      );
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
      expect(changed).not.toHaveBeenCalled();
      await editSearch("hong");
      await act(() =>
        requireValue(
          document.querySelector<HTMLElement>('[role="option"]')
        ).click()
      );
      expect(changed).toHaveBeenCalledExactlyOnceWith("hk");
      expect(trigger.value).toBe("Hong Kong");
      expect(
        container.querySelector(".pw-guided-form-picker-code")?.textContent
      ).toBe("HK02");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      await act(() => trigger.click());
      expect(
        document.querySelector<HTMLInputElement>('input[role="combobox"]')
          ?.value
      ).toBe("Hong Kong");
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
      await editSearch("uncommitted search");
      await act(() =>
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
      );
      expect(trigger.value).toBe("Hong Kong");
      expect(changed).toHaveBeenCalledOnce();
      await act(() =>
        requireValue(
          container.querySelector<HTMLButtonElement>(
            '[aria-label="Clear selected template"]'
          )
        ).click()
      );
      expect(changed).toHaveBeenLastCalledWith("");
      expect(trigger.value).toBe("");
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });

  it("does not open a disabled searchable selector", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(
          <GuidedFormSelect
            id="disabled-search"
            disabled
            value=""
            onValueChange={vi.fn()}
            options={[]}
            placeholder="Unavailable"
            search={{
              placeholder: "Search",
              groupLabel: "Items",
              emptyLabel: "No results",
              clearLabel: "Clear",
              clearSelectionLabel: "Clear selection",
            }}
          />
        )
      );
      const trigger = requireValue(
        container.querySelector<HTMLInputElement>("#disabled-search")
      );
      expect(trigger.disabled).toBeTruthy();
      await act(() => trigger.click());
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    } finally {
      await act(() => root.unmount());
    }
  });

  it("associates field label, help, validation and required semantics without inventing submission validation", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(
          <GuidedFormField
            id="name"
            label="项目名称"
            required
            description="项目名称可以修改"
            error="请输入项目名称"
            describedBy="additional-help"
          >
            {(control) => <Input {...control} />}
          </GuidedFormField>
        )
      );
      const input = container.querySelector("input");
      expect(input?.id).toBe("name");
      expect(container.querySelector("label")?.htmlFor).toBe("name");
      expect(input?.getAttribute("aria-describedby")).toBe(
        "additional-help name-help name-error"
      );
      expect(input?.getAttribute("aria-invalid")).toBe("true");
      expect(input?.getAttribute("aria-required")).toBe("true");
      expect(input?.required).toBeFalsy();
      expect(container.querySelector('[role="alert"]')?.id).toBe("name-error");
    } finally {
      await act(() => root.unmount());
    }
  });

  it.each(["columns", "inline"] as const)(
    "keeps %s radio choices exclusive, controlled and non-submitting",
    async (layout) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const changed = vi.fn();
      function ChoiceFixture() {
        const [value, setValue] = useState("a");
        return (
          <GuidedFormChoices
            label="项目来源"
            layout={layout}
            value={value}
            onValueChange={(next) => {
              setValue(next);
              changed(next);
            }}
            options={[
              { value: "a", label: "从业务创建" },
              { value: "b", label: "快速创建" },
            ]}
          />
        );
      }
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      try {
        await act(() => root.render(<ChoiceFixture />));
        const choices = container.querySelectorAll<HTMLInputElement>(
          'input[type="radio"]'
        );
        expect(choices[0].name).toBe(choices[1].name);
        await act(() => choices[1].click());
        expect(changed).toHaveBeenCalledExactlyOnceWith("b");
        expect(choices[1].checked).toBeTruthy();
        expect(choices[0].checked).toBeFalsy();
        expect(container.querySelectorAll('input[type="submit"]')).toHaveLength(
          0
        );
      } finally {
        await act(() => root.unmount());
        container.remove();
      }
    }
  );

  it.each(["plain", "grouped"] as const)(
    "preserves the caller's step eligibility with %s presentation",
    async (appearance) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const change = vi.fn();
      const container = document.createElement("div");
      const root = createRoot(container);
      try {
        await act(() =>
          root.render(
            <GuidedForm
              label="创建项目"
              appearance={appearance}
              value="source"
              onValueChange={change}
              steps={[
                { id: "source", label: "项目来源" },
                { id: "setup", label: "项目设置", disabled: true },
              ]}
              actions={<Button disabled>复核并创建</Button>}
              aside={
                <GuidedFormSummary
                  title="创建摘要"
                  status={<Badge variant="success-light">资料完整</Badge>}
                  items={[{ label: "项目来源", value: "快速创建" }]}
                />
              }
            >
              <GuidedFormSection title="项目设置">
                <GuidedFormField id="readonly" label="项目代码">
                  {(control) => (
                    <Input {...control} readOnly value="AUD-2026-0001" />
                  )}
                </GuidedFormField>
              </GuidedFormSection>
            </GuidedForm>
          )
        );
        const buttons =
          container.querySelectorAll<HTMLButtonElement>("nav button");
        expect(buttons[0].getAttribute("aria-current")).toBe("step");
        expect(
          container.querySelector<HTMLElement>(".pw-guided-form")?.dataset
            .appearance
        ).toBe(appearance);
        expect(buttons[1].disabled).toBeTruthy();
        await act(() => buttons[1].click());
        expect(change).not.toHaveBeenCalled();
        await act(() => buttons[0].click());
        expect(change).toHaveBeenCalledExactlyOnceWith("source");
        expect(container.querySelector("input")?.readOnly).toBeTruthy();
        expect(
          container.querySelector(".pw-guided-form-summary")?.textContent
        ).toContain("资料完整");
      } finally {
        await act(() => root.unmount());
      }
    }
  );
});
