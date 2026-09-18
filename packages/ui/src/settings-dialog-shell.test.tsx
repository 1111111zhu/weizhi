import { Settings } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  SETTINGS_DIALOG_CONTENT_CLASS,
  SETTINGS_DIALOG_OVERLAY_CLASS,
  SettingsDialogShell,
  SIDEBAR_13_DIALOG_CONTENT_CLASS,
  SIDEBAR_13_DIALOG_OVERLAY_CLASS,
} from "./settings-dialog-shell";

describe("settings dialog accessibility contract", () => {
  it("keeps navigation badges separate from the page label", () => {
    const markup = renderToStaticMarkup(
      <SettingsDialogShell
        activeId="issues"
        breadcrumbRoot="Agent"
        items={[
          {
            id: "issues",
            label: "Issues",
            icon: Settings,
            badge: <span>3</span>,
          },
        ]}
        navigationLabel="Sections"
        onActiveIdChange={vi.fn()}
      >
        <p>Content</p>
      </SettingsDialogShell>
    );
    expect(markup).toContain('data-slot="settings-navigation-badge"');
    expect(markup).not.toContain("Issues · 3");
    expect(markup).toContain(
      'aria-current="page" class="text-foreground">Issues</span>'
    );
  });
  it("keeps contextual actions optional for existing consumers", () => {
    const markup = renderToStaticMarkup(
      <SettingsDialogShell
        activeId="settings"
        breadcrumbRoot="Settings"
        items={[{ id: "settings", label: "Settings", icon: Settings }]}
        navigationLabel="Sections"
        onActiveIdChange={vi.fn()}
      >
        <p>Content</p>
      </SettingsDialogShell>
    );
    expect(markup).not.toContain('data-slot="settings-header-actions"');
    expect(markup).toContain("Content");
  });
  it("renders the shared navigation, breadcrumb, and active page semantics", () => {
    const markup = renderToStaticMarkup(
      <SettingsDialogShell
        activeId="personal"
        breadcrumbRoot="Settings"
        items={[
          { id: "personal", icon: Settings, label: "Personalization" },
          { id: "currency", icon: Settings, label: "Currency" },
        ]}
        navigationLabel="Settings navigation"
        onActiveIdChange={vi.fn()}
        headerActions={<span>384 KB · 3 files</span>}
      >
        <p>Personal settings content</p>
      </SettingsDialogShell>
    );

    expect(markup).toContain('aria-label="Settings navigation"');
    expect(markup).toContain('data-slot="settings-header-actions"');
    expect(markup.indexOf("384 KB · 3 files")).toBeLessThan(
      markup.indexOf("</header>")
    );
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Settings");
    expect(markup).toContain("Personalization");
    expect(markup).toContain("Personal settings content");
    expect(markup).toContain("<section");
    expect(markup).toContain('aria-label="Personalization"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Settings navigation"');
  });

  it("keeps the EMP sizing aliases identical to the shared constants", () => {
    expect(SIDEBAR_13_DIALOG_CONTENT_CLASS).toBe(SETTINGS_DIALOG_CONTENT_CLASS);
    expect(SIDEBAR_13_DIALOG_OVERLAY_CLASS).toBe(SETTINGS_DIALOG_OVERLAY_CLASS);
    expect(SETTINGS_DIALOG_CONTENT_CLASS).toContain("h-[80dvh]");
    expect(SETTINGS_DIALOG_CONTENT_CLASS).toContain("w-[80vw]");
    expect(SETTINGS_DIALOG_CONTENT_CLASS).toContain(
      "max-md:w-[calc(100vw-1rem)]"
    );
  });
});
