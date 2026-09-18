import { describe, expect, it } from "vitest";

import {
  CmpClientProfileSchema,
  CreateCmpClientProfileSchema,
} from "./cmp-client-profile.js";

describe("cMP client profile contracts", () => {
  it("accepts a minimal client-centric profile", () => {
    expect(
      CreateCmpClientProfileSchema.parse({
        clientCode: "C-001",
        nameEn: "Example Limited",
      })
    ).toStrictEqual({
      clientCode: "C-001",
      nameEn: "Example Limited",
      status: "ACTIVE",
    });
  });

  it("requires at least one client name", () => {
    expect(
      CreateCmpClientProfileSchema.safeParse({ clientCode: "C-001" }).success
    ).toBeFalsy();
  });

  it("accepts an ordered list of client contacts", () => {
    const profile = CreateCmpClientProfileSchema.parse({
      clientCode: "C-001",
      nameEn: "Example Limited",
      contacts: [
        {
          name: "Cathy Ho",
          email: "cathy@example.com",
          sortOrder: 0,
        },
        {
          name: "Alex Chan",
          mobile: "+852 9234 5678",
          sortOrder: 1,
        },
      ],
    });

    expect(profile.contacts).toHaveLength(2);
    expect(profile.contacts?.[0]?.email).toBe("cathy@example.com");
  });

  it("parses a created client with its root company entity", () => {
    expect(
      CmpClientProfileSchema.parse({
        id: "client-1",
        clientCode: "C-001",
        status: "ACTIVE",
        nameEn: "Example Limited",
        nameZh: null,
        companyNumber: "1234567",
        jurisdiction: "Hong Kong",
        incorporationYearMonth: null,
        yearEndDate: null,
        yearEndMonth: null,
        hsicSectionCode: null,
        industryOtherDescription: null,
        reportingGaap: null,
        address: null,
        registeredAddress: null,
        principalBusinessAddress: null,
        principalAddressSameAsRegistered: false,
        additionalAddresses: [],
        contactPerson: null,
        telephone: null,
        contactPosition: null,
        contactDepartment: null,
        contactMobile: null,
        contactRemarks: null,
        email: null,
        website: null,
        referredBy: null,
        clientLeadingPartnerId: null,
        clientLeadingPartner: null,
        clientPartnerPicId: null,
        clientPartnerPic: null,
        clientManagerMicId: null,
        clientManagerMic: null,
        alternativePartnerSecondMicId: null,
        alternativePartnerSecondMic: null,
        remarks: null,
        rootEntity: {
          id: "cmp_entity_client-1",
          kind: "COMPANY",
          displayName: "Example Limited",
          jurisdiction: "Hong Kong",
          registrationNumber: "1234567",
        },
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      }).rootEntity?.displayName
    ).toBe("Example Limited");
  });
});
