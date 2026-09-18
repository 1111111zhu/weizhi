// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MemberDirectoryCell,
  MemberDirectoryRow,
  MemberDirectoryTable,
} from "./member-directory";

describe(MemberDirectoryTable, () => {
  it.each(["assignment", "management"] as const)(
    "contains %s table overflow in a named keyboard-accessible region",
    (layout) => {
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(
        <MemberDirectoryTable
          label="Project members"
          headers={["Member", "Role"]}
          layout={layout}
        >
          <MemberDirectoryRow>
            <MemberDirectoryCell>Alex</MemberDirectoryCell>
            <MemberDirectoryCell>Reviewer</MemberDirectoryCell>
          </MemberDirectoryRow>
        </MemberDirectoryTable>
      );
      const region = container.querySelector('[role="region"]');
      expect(region?.getAttribute("aria-label")).toBe("Project members");
      expect(region?.getAttribute("tabindex")).toBe("0");
      expect(region?.classList.contains("overflow-x-auto")).toBeTruthy();
      expect(
        region?.querySelectorAll('[role="table"] [role="cell"]')
      ).toHaveLength(2);
    }
  );
});
