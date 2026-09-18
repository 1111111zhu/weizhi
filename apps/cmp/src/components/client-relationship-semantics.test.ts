import { describe, expect, it } from "vitest";

import {
  relationshipTypesForSourceKind,
  relationshipSupportsInterestDetails,
} from "./client-relationship-semantics";

describe("client relationship semantics", () => {
  it("limits company sources to ownership and exposes person-only roles", () => {
    expect(relationshipTypesForSourceKind("COMPANY")).toStrictEqual(["OWNS"]);
    expect(relationshipTypesForSourceKind("PERSON")).toStrictEqual([
      "OWNS",
      "DIRECTOR_OF",
      "BENEFICIAL_OWNER_OF",
      "COMPANY_SECRETARY_OF",
      "MANAGES",
      "OTHER",
    ]);
    expect(relationshipTypesForSourceKind("TRUST")).toStrictEqual([]);
  });

  it("shows an optional interest percentage only for direct ownership", () => {
    expect(relationshipSupportsInterestDetails("OWNS")).toBeTruthy();
    expect(relationshipSupportsInterestDetails("DIRECTOR_OF")).toBeFalsy();
    expect(relationshipSupportsInterestDetails("OTHER")).toBeFalsy();
  });
});
