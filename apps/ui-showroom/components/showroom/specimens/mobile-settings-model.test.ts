import { describe, expect, it } from "vitest";

import { mobileAccountRank } from "./mobile-account-model";
import {
  canViewMobileSettingsPage,
  mobileSettingsPages,
  mobileSettingsParent,
  mobileSettingsTitle,
} from "./mobile-settings-model";
import {
  initialMobileRoute,
  mobileRouteHref,
  parseMobileRoute,
} from "./mobile-workspace-model";

describe("mobile settings destinations", () => {
  it("displays account grades rather than project responsibilities", () => {
    expect(mobileAccountRank("MANAGER")).toBe("Manager");
    expect(mobileAccountRank("STAFF")).toBe("Staff");
    expect(mobileAccountRank("PRINCIPAL")).toBe("Principal");
    expect(mobileAccountRank(null)).toBe("—");
    expect(mobileAccountRank()).toBe("—");
  });

  it("keeps EMP work items distinct from review-note tasks and confirmations", () => {
    const route = { ...initialMobileRoute, screen: "emp-work-items" as const };
    expect(mobileRouteHref(route)).toBe("#emp-work-items");
    expect(parseMobileRoute(mobileRouteHref(route))).toStrictEqual(route);
    expect(parseMobileRoute("#tasks").screen).toBe("tasks");
    expect(parseMobileRoute("#confirmations").screen).toBe("confirmations");
  });

  it("roundtrips every settings category without changing object identity", () => {
    for (const section of Object.keys(mobileSettingsPages)) {
      const route = {
        ...initialMobileRoute,
        screen: "settings" as const,
        section,
      };
      expect(parseMobileRoute(mobileRouteHref(route))).toStrictEqual(route);
    }
  });

  it("returns nested service pages to their own category", () => {
    expect(mobileSettingsParent("mail")).toBe("integrations");
    expect(mobileSettingsParent("agentCache")).toBe("desktopAgent");
    expect(mobileSettingsParent("tracking")).toBe("systemConnections");
    expect(mobileSettingsTitle("appearance")).toBe("个性化");
    expect(parseMobileRoute("#settings?section=unknown").section).toBe("");
  });

  it("does not grant administrator access through a direct settings URL", () => {
    for (const section of ["systemConnections", "tracking"]) {
      expect(canViewMobileSettingsPage(section, false)).toBeFalsy();
      expect(canViewMobileSettingsPage(section, true)).toBeTruthy();
    }
    expect(canViewMobileSettingsPage("mail", false)).toBeTruthy();
  });
});
