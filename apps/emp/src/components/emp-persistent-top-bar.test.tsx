import type { ProjectWingTopBar } from "@project-wing/ui";
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmpRouteTopBar, EmpTopBarProvider } from "./emp-persistent-top-bar";

vi.mock("@project-wing/ui", () => ({
  ProjectWingTopBar: ({
    leading,
    actions,
    ...props
  }: ComponentProps<typeof ProjectWingTopBar>) => (
    <header {...props}>
      {leading}
      {actions}
    </header>
  ),
  ProjectWingTopBarBrand: () => <span>EMP</span>,
}));
vi.mock("./project-wing-top-bar-controls", () => ({
  EmpPortalAction: () => <button type="button">Portal</button>,
  EmpTopBarControls: () => <button type="button">Home</button>,
}));

function Route({
  project,
  ready = true,
}: {
  project: boolean;
  ready?: boolean;
}) {
  return (
    <EmpRouteTopBar
      ready={ready}
      leading={<span>EMP</span>}
      actions={
        <>
          <button key="home" type="button">
            Home
          </button>
          {project ? (
            <button key="project" type="button">
              Project
            </button>
          ) : null}
        </>
      }
    />
  );
}

describe("persistent EMP header", () => {
  afterEach(cleanup);

  it("keeps the same header and common action through route loading and context changes", () => {
    const { rerender } = render(
      <EmpTopBarProvider enabled>
        <main>
          <Route project={false} />
        </main>
      </EmpTopBarProvider>
    );
    const header = screen.getByRole("banner");
    const home = screen.getByRole("button", { name: "Home" });
    expect(header.closest("main")).toBeNull();
    rerender(
      <EmpTopBarProvider enabled>
        <main>Loading route</main>
      </EmpTopBarProvider>
    );
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("button", { name: "Home" })).toBe(home);
    rerender(
      <EmpTopBarProvider enabled>
        <main>
          <Route project ready={false} />
        </main>
      </EmpTopBarProvider>
    );
    expect(screen.queryByRole("button", { name: "Project" })).toBeNull();
    rerender(
      <EmpTopBarProvider enabled>
        <main>
          <Route project />
        </main>
      </EmpTopBarProvider>
    );
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("button", { name: "Home" })).toBe(home);
    expect(screen.getByRole("button", { name: "Project" })).toBeTruthy();
    rerender(
      <EmpTopBarProvider enabled>
        <main>
          <Route project={false} />
        </main>
      </EmpTopBarProvider>
    );
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.queryByRole("button", { name: "Project" })).toBeNull();
  });
});
