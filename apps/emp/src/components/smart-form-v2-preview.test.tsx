// @vitest-environment jsdom
import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n/client";
import { getDictionary } from "../i18n/dictionaries";
import { SmartFormV2Preview } from "./smart-form-v2-preview";

vi.mock("./language-switcher", () => ({ LanguageSwitcher: () => null }));

describe("mobile SmartForm mode changes", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("previews the draft and restores unsaved edits without marking them saved", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const dictionary = await getDictionary("en-US");
    const { container } = render(
      <I18nProvider locale="en-US" dictionary={dictionary}>
        <SmartFormV2Preview
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
        />
      </I18nProvider>
    );
    const user = userEvent.setup();
    const documentView = () => {
      const element = container.querySelector<HTMLElement>(
        ".smart-form-v2-document"
      );
      if (!element) {
        throw new Error("Missing SmartForm document");
      }
      return within(element);
    };
    await user.click(
      screen.getAllByRole("button", { name: "Edit: Test required" })[0]
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "No",
      })
    );
    const copy = dictionary.smartFormV2Editor;
    expect(screen.getByText(copy.unsaved)).toBeInTheDocument();
    await user.click(
      documentView().getByRole("button", { name: copy.previewMode })
    );
    const record = container.querySelector<HTMLElement>(
      "[data-smart-form-mobile-records] article"
    );
    if (!record) {
      throw new Error("Missing mobile preview record");
    }
    expect(within(record).getByText("No", { exact: true })).toBeInTheDocument();
    await user.click(
      documentView().getByRole("button", { name: copy.entryMode })
    );
    expect(screen.getByText(copy.unsaved)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.save })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: copy.save }));
    await expect(screen.findByText(copy.saved)).resolves.toBeInTheDocument();
  });
});
