// @vitest-environment jsdom
import { Button, ProjectWingThemeProvider } from "@project-wing/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConfirmationLibraryMobile,
  ConfirmationLibraryRecord,
} from "./confirmation-library-mobile";

describe("phone confirmation library composition", () => {
  afterEach(cleanup);

  it("keeps record opening separate from the action sheet", async () => {
    const openRecord = vi.fn();
    const download = vi.fn();
    render(
      <ProjectWingThemeProvider>
        <ConfirmationLibraryMobile
          locale="en-US"
          title="Templates"
          search={null}
          actions={null}
          filters={null}
          loading={false}
          count={1}
          empty="No templates"
        >
          <ConfirmationLibraryRecord
            locale="en-US"
            id="one"
            title="Long template name"
            description="TMP-001"
            onOpen={openRecord}
            actions={<Button onClick={download}>Download</Button>}
          />
        </ConfirmationLibraryMobile>
      </ProjectWingThemeProvider>
    );
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "More actions: Long template name" })
    );
    const sheet = await screen.findByRole("dialog", {
      name: "Long template name",
    });
    expect(openRecord).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Download" }));
    expect(download).toHaveBeenCalledOnce();
  });

  it("preserves supplied filter and management controls", async () => {
    render(
      <ProjectWingThemeProvider>
        <ConfirmationLibraryMobile
          locale="en-US"
          title="Information"
          search={null}
          actions={<Button>Add entry</Button>}
          filters={<Button>Bank type</Button>}
          loading={false}
          count={0}
          empty="No banks"
        >
          {null}
        </ConfirmationLibraryMobile>
      </ProjectWingThemeProvider>
    );
    expect(screen.getByText("No banks")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sort and filter" }));
    const sheet = await screen.findByRole("dialog", { name: "List actions" });
    expect(
      within(sheet).getByRole("button", { name: "Add entry" })
    ).toBeTruthy();
    expect(
      within(sheet).getByRole("button", { name: "Bank type" })
    ).toBeTruthy();
  });

  it("does not show an empty result while loading and supports error retry", () => {
    const retry = vi.fn();
    const result = render(
      <ProjectWingThemeProvider>
        <ConfirmationLibraryMobile
          locale="en-US"
          title="Information"
          search={null}
          actions={null}
          filters={null}
          loading
          count={0}
          empty="No banks"
        >
          {null}
        </ConfirmationLibraryMobile>
      </ProjectWingThemeProvider>
    );
    expect(screen.queryByText("No banks")).toBeNull();
    result.rerender(
      <ProjectWingThemeProvider>
        <ConfirmationLibraryMobile
          locale="en-US"
          title="Information"
          search={null}
          actions={null}
          filters={null}
          loading={false}
          error
          onRetry={retry}
          count={0}
          empty="No banks"
        >
          {null}
        </ConfirmationLibraryMobile>
      </ProjectWingThemeProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
