import { webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { ProjectWingThemeProvider, themeCookieNames } from "@project-wing/ui";
import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  IntranetFluentProvider,
  getIntranetFluentTheme,
} from "./intranet-fluent-provider";

describe(getIntranetFluentTheme, () => {
  afterEach(() => {
    // oxlint-disable-next-line unicorn/no-document-cookie -- Mirrors the production cookie-backed theme provider in a DOM test.
    document.cookie = `${themeCookieNames.flavor}=; path=/; max-age=0`;
    document.documentElement.className = "";
  });

  it("uses Fluent dark neutrals while preserving the Intranet brand bridge", () => {
    expect(getIntranetFluentTheme("mocha")).toMatchObject({
      colorBrandBackground: "var(--primary)",
      colorNeutralBackground1: webDarkTheme.colorNeutralBackground1,
      colorNeutralForeground1: webDarkTheme.colorNeutralForeground1,
    });
  });

  it("keeps Fluent light neutrals in day mode", () => {
    expect(getIntranetFluentTheme("latte")).toMatchObject({
      colorBrandBackground: "var(--primary)",
      colorNeutralBackground1: webLightTheme.colorNeutralBackground1,
      colorNeutralForeground1: webLightTheme.colorNeutralForeground1,
    });
  });

  it("hydrates from the stable day theme before applying a persisted night theme", async () => {
    const serverMarkup = renderToString(
      <ProjectWingThemeProvider
        initialTheme={{ flavor: "mocha", accent: "lime", fontSize: "md" }}
      >
        <IntranetFluentProvider>Content</IntranetFluentProvider>
      </ProjectWingThemeProvider>
    );
    expect(serverMarkup).toContain('data-intranet-fluent-theme="latte"');

    // oxlint-disable-next-line unicorn/no-document-cookie -- The shared theme provider reads this compatibility cookie directly.
    document.cookie = `${themeCookieNames.flavor}=mocha; path=/`;
    const { container } = render(
      <ProjectWingThemeProvider>
        <IntranetFluentProvider>Content</IntranetFluentProvider>
      </ProjectWingThemeProvider>
    );

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>("[data-intranet-fluent-theme]")
          ?.dataset.intranetFluentTheme
      ).toBe("mocha");
    });
  });
});
