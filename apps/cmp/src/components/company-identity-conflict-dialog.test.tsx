import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompanyIdentityConflictDialog } from "./company-identity-conflict-dialog";

const match = {
  entity: {
    id: "entity-1",
    kind: "COMPANY" as const,
    displayName: "Existing Limited",
    nameZh: null,
    nameEn: "Existing Limited",
    jurisdiction: "Hong Kong",
    registrationNumber: "240379",
    incorporationDate: null,
    dateOfBirth: null,
    nationality: null,
    status: "ACTIVE" as const,
    remarks: null,
    role: "RELATED" as const,
    companyProfile: {
      identifierType: "COMPANY_REGISTRATION_NUMBER",
      identifierValue: "240379",
      incorporationDate: null,
      companyType: "PRIVATE" as const,
      industryClassification: null,
      registeredAddress: "Central",
      principalBusinessAddress: null,
    },
    personProfile: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  },
  clients: [
    {
      id: "client-1",
      clientCode: "C-001",
      nameEn: "Existing Limited",
      nameZh: "",
      role: "ROOT" as const,
    },
  ],
};

describe(CompanyIdentityConflictDialog, () => {
  it("returns an explicit link or update resolution", () => {
    const onResolve = vi.fn();
    render(
      <CompanyIdentityConflictDialog
        open
        zh
        current={{
          displayName: "New description",
          identifierType: "COMPANY_REGISTRATION_NUMBER",
          identifierValue: "240379",
        }}
        match={match}
        onCancel={vi.fn()}
        onResolve={onResolve}
      />
    );

    expect(screen.getAllByText("Existing Limited").length).toBeGreaterThan(0);
    expect(screen.getByText("C-001 · Existing Limited")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "引用已有公司" }));
    expect(onResolve).toHaveBeenCalledWith({
      action: "LINK_EXISTING",
      entityId: "entity-1",
      expectedUpdatedAt: "2026-08-10T00:00:00.000Z",
    });
  });
});
