// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MobileListItem,
  MobileNavigation,
  MobilePageHeader,
  MobileScaffold,
  MobileComposer,
  MobileSelectionRow,
  MobileTextArea,
} from "./mobile-workspace";
import { ViewSwitcher } from "./view-switcher";

function render(markup: string) {
  const element = document.createElement("div");
  element.innerHTML = markup;
  return element;
}

describe("experimental mobile navigation contracts", () => {
  it("keeps secondary actions outside the file link and optionally omits the chevron", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileListItem
          title="File"
          description="A-01"
          href="#file"
          showChevron={false}
          secondaryAction={<span>Signatures</span>}
          action={<span>Notes</span>}
        />
      )
    );
    expect(element.querySelector(".pw-mobile-chevron")).toBeNull();
    expect(element.querySelector("a")?.textContent).toBe("FileA-01");
    expect(
      element.querySelector(".pw-mobile-list-secondary-action")?.textContent
    ).toBe("Signatures");
  });

  it("forwards multiline field validation and disabled state", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileTextArea
          aria-label="Notes"
          aria-invalid
          aria-describedby="notes-error"
          disabled
          maxLength={2000}
        />
      )
    );
    const input = element.querySelector("textarea");
    expect(input?.getAttribute("aria-describedby")).toBe("notes-error");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.hasAttribute("disabled")).toBeTruthy();
    expect(input?.getAttribute("maxlength")).toBe("2000");
  });

  it("exposes select validation and disables selection when requested", () => {
    const element = render(
      renderToStaticMarkup(
        <ViewSwitcher
          label="Project"
          value="one"
          options={[{ value: "one", label: "One" }]}
          onValueChange={() => {}}
          disabled
          invalid
          descriptionId="project-error"
        />
      )
    );
    const trigger = element.querySelector('[role="combobox"]');
    expect(trigger?.getAttribute("aria-describedby")).toBe("project-error");
    expect(trigger?.getAttribute("aria-invalid")).toBe("true");
    expect(trigger?.hasAttribute("disabled")).toBeTruthy();
  });

  it("exposes explicit checkbox selection rather than opening a file in selection mode", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileSelectionRow
          title="Select evidence"
          checked
          onCheckedChange={() => {}}
        />
      )
    );
    expect(
      element.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")
    ).toBe("true");
    expect(element.querySelector("a")).toBeNull();
  });

  it("provides a named multiline composer and prevents sending an empty reply", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileComposer
          value=""
          onValueChange={() => {}}
          onSubmit={() => {}}
          label="Reply"
          submitLabel="Send"
        />
      )
    );
    expect(element.querySelector("textarea")?.getAttribute("aria-label")).toBe(
      "Reply"
    );
    expect(
      element.querySelector('button[type="submit"]')?.hasAttribute("disabled")
    ).toBeTruthy();
  });

  it("keeps primary destinations as real links with a single current page", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileNavigation
          label="Primary"
          activeId="tasks"
          items={[
            {
              id: "projects",
              label: "Projects",
              href: "#projects",
              icon: null,
            },
            { id: "tasks", label: "Tasks", href: "#tasks", icon: null },
          ]}
        />
      )
    );
    expect(element.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(
      element.querySelector('a[aria-current="page"]')?.getAttribute("href")
    ).toBe("#tasks");
    expect(element.querySelector("nav")?.getAttribute("aria-label")).toBe(
      "Primary"
    );
  });

  it("keeps the row destination and secondary action as separate non-nested controls", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileListItem
          title="Evidence"
          href="#file"
          description="PDF"
          action={<button type="button">More</button>}
        />
      )
    );
    expect(element.querySelector("a")?.getAttribute("href")).toBe("#file");
    expect(element.querySelector("a button")).toBeNull();
    expect(element.querySelector("button")?.textContent).toBe("More");
  });

  it("gives icon-only back links an explicit destination and accessible name", () => {
    const element = render(
      renderToStaticMarkup(
        <MobilePageHeader
          title="Notes"
          back={{ label: "Back to files", href: "#files" }}
        />
      )
    );
    expect(element.querySelector("a")?.getAttribute("aria-label")).toBe(
      "Back to files"
    );
    expect(element.querySelector("a")?.getAttribute("href")).toBe("#files");
    expect(element.querySelectorAll("h1")).toHaveLength(1);
  });

  it("keeps the footer outside the scrolling content region", () => {
    const element = render(
      renderToStaticMarkup(
        <MobileScaffold
          label="Demo"
          header={<header>Header</header>}
          footer={<nav>Navigation</nav>}
        >
          <p>Content</p>
        </MobileScaffold>
      )
    );
    expect(element.querySelector("section > footer > nav")).not.toBeNull();
    expect(element.querySelector("section > div footer")).toBeNull();
  });
});
