import { describe, expect, it } from "vitest";

import {
  EMPTY_CLIENT_MASTER_FORM,
  CLIENT_FORM_SECTION_ORDER,
  buildClientPayload,
  buildRelatedPartyStructureGraph,
  clientMasterFormFromPayload,
  parseClientServiceTypes,
  serializeClientServiceTypes,
  validateClientForm,
  validateClientIdentifiers,
} from "./client-master-form";

describe("clientMasterForm validation", () => {
  it("places AML between relationships and responsible users", () => {
    expect(CLIENT_FORM_SECTION_ORDER).toStrictEqual([
      "basic",
      "relationships",
      "aml",
      "responsible",
    ]);
  });

  it("derives the read-only entity structure from draft parties and group relationships", () => {
    const graph = buildRelatedPartyStructureGraph(
      {
        ...EMPTY_CLIENT_MASTER_FORM,
        clientCode: "C-001",
        nameEn: "Client Limited",
        relatedEntities: [
          {
            draftKey: "owner-draft",
            kind: "COMPANY",
            displayName: "Owner Holdings Limited",
            nameEn: "Owner Holdings Limited",
            jurisdiction: "Hong Kong",
            status: "ACTIVE",
          },
        ],
        relatedRelationships: [
          {
            draftKey: "owns-draft",
            fromRef: { type: "DRAFT", draftKey: "owner-draft" },
            toRef: { type: "ROOT" },
            type: "OWNS",
            ownershipPercentage: 100,
          },
        ],
        relatedGroupRelationships: [
          {
            draftKey: "joint-venture-draft",
            targetRef: { type: "ROOT" },
            type: "JOINT_VENTURE",
            participants: [
              {
                entityRef: { type: "DRAFT", draftKey: "owner-draft" },
                method: "OTHER",
                otherDescription: "Contractual arrangement",
              },
            ],
          },
        ],
      },
      true
    );

    expect(graph.nodes.map((node) => node.displayName)).toStrictEqual([
      "Client Limited",
      "Owner Holdings Limited",
    ]);
    expect(graph.edges).toStrictEqual([
      expect.objectContaining({
        fromEntityId: "owner-draft",
        toEntityId: "ROOT",
        type: "OWNS",
        ownershipPercentage: 100,
      }),
    ]);
    expect(graph.groupRelationships).toStrictEqual([
      expect.objectContaining({
        type: "JOINT_VENTURE",
        targetEntityId: "ROOT",
        participants: [
          expect.objectContaining({
            entityId: "owner-draft",
            method: "OTHER",
            ownershipPercentage: null,
          }),
        ],
      }),
    ]);
  });

  it("requires the current formal Client Acceptance fields", () => {
    const errors = validateClientForm(EMPTY_CLIENT_MASTER_FORM, {
      requiresRouting: true,
    });

    expect(errors).toStrictEqual({
      clientCode: "Client Code is required.",
      companyCode: "Company Code is required.",
      companyNumber: "Company Number is required.",
      status: "Client Status is required.",
      nameEn: "Company Name English or Chinese is required.",
      nameZh: "Company Name English or Chinese is required.",
      yearEndMonth: "Year end month is required.",
      registeredAddress: "Registered address is required.",
      principalBusinessAddress: "Principal business address is required.",
      placeOfIncorporation: "Place of Incorporation is required.",
      listedOrPrivate: "Company Type is required.",
      clientLeadingPartnerId: "Client Leading Partner is required.",
      clientPartnerPicId: "PIC is required.",
      clientManagerMicId: "MIC is required.",
      serviceType: "Service Type is required.",
    });
  });

  it("does not serialize untouched Client select defaults into a draft", () => {
    const payload = buildClientPayload(EMPTY_CLIENT_MASTER_FORM);

    expect(payload.status).toBeUndefined();
    expect(payload.listedOrPrivate).toBeUndefined();
  });

  it("serializes multiple contacts and mirrors the first contact for legacy readers", () => {
    const payload = buildClientPayload({
      ...EMPTY_CLIENT_MASTER_FORM,
      contacts: [
        {
          id: "contact-1",
          key: "contact-1",
          name: "Cathy Ho",
          position: "Finance Director",
          department: "Finance",
          officePhone: "+852 2818 6200",
          mobile: "+852 9123 4567",
          email: "cathy@example.com",
          remarks: "Primary contact",
        },
        {
          id: "",
          key: "draft-contact-2",
          name: "Alex Chan",
          position: "Accountant",
          department: "Finance",
          officePhone: "",
          mobile: "+852 9234 5678",
          email: "alex@example.com",
          remarks: "",
        },
      ],
    });

    expect(payload.contacts).toStrictEqual([
      expect.objectContaining({
        id: "contact-1",
        name: "Cathy Ho",
        sortOrder: 0,
      }),
      expect.objectContaining({
        id: undefined,
        name: "Alex Chan",
        sortOrder: 1,
      }),
    ]);
    expect(payload).toMatchObject({
      contactPerson: "Cathy Ho",
      contactPosition: "Finance Director",
      telephone: "+852 2818 6200",
      email: "cathy@example.com",
    });
  });

  it("migrates legacy contact fields but preserves an explicitly cleared contact list", () => {
    const legacyForm = clientMasterFormFromPayload({
      contactPerson: "Cathy Ho",
      telephone: "+852 2818 6200",
      email: "cathy@example.com",
    });
    const clearedForm = clientMasterFormFromPayload({
      contactPerson: "Cathy Ho",
      contacts: [],
    });

    expect(legacyForm.contacts).toStrictEqual([
      expect.objectContaining({
        name: "Cathy Ho",
        officePhone: "+852 2818 6200",
        email: "cathy@example.com",
      }),
    ]);
    expect(clearedForm.contacts).toStrictEqual([]);
  });

  it("requires an Other Industry Description only when Industry is Other", () => {
    const errors = validateClientForm(
      {
        ...EMPTY_CLIENT_MASTER_FORM,
        clientCode: "C-001",
        nameEn: "Huaqian Limited",
        hsicSectionCode: "OTHER",
      },
      { requiresRouting: false }
    );

    expect(errors.industryOtherDescription).toBe(
      "Other Industry Description is required."
    );
  });

  it("serializes simplified incorporation and industry fields only", () => {
    const payload = buildClientPayload({
      ...EMPTY_CLIENT_MASTER_FORM,
      clientCode: "C-001",
      nameEn: "Huaqian Limited",
      incorporationYearMonth: "2026-04-15",
      hsicSectionCode: "OTHER",
      industryOtherDescription: "Specialist advisory",
      reportingGaap: "HKFRS",
    });

    expect(payload).toMatchObject({
      incorporationYearMonth: "2026-04-15",
      hsicSectionCode: "OTHER",
      industryOtherDescription: "Specialist advisory",
      reportingGaap: "HKFRS",
    });
    expect(payload).not.toHaveProperty("dateOfIncorporation");
    expect(payload).not.toHaveProperty("countryOrDistrict");
  });

  it("accepts a Chinese company name when English is blank", () => {
    const errors = validateClientForm(
      {
        ...EMPTY_CLIENT_MASTER_FORM,
        clientCode: "C-001",
        nameZh: "华乾有限公司",
      },
      { requiresRouting: false }
    );

    expect(errors.nameEn).toBeUndefined();
    expect(errors.nameZh).toBeUndefined();
  });

  it("accepts an empty Chinese name when the English name is supplied", () => {
    const errors = validateClientForm(
      {
        ...EMPTY_CLIENT_MASTER_FORM,
        clientCode: "C-001",
        nameEn: "Huaqian Limited",
        nameZh: "",
      },
      { requiresRouting: false }
    );

    expect(errors.nameEn).toBeUndefined();
    expect(errors.nameZh).toBeUndefined();
  });

  it("does not submit legacy Group data", () => {
    const payload = buildClientPayload({
      ...EMPTY_CLIENT_MASTER_FORM,
      groupMode: "HAS_GROUP",
      groupId: "group-1",
      isUltimateParent: true,
      wasUltimateParent: true,
    });

    expect(payload.groupStructure).toBeUndefined();
  });

  it("preserves the approved Ultimate Parent state when a draft proposal is unchanged", () => {
    const form = clientMasterFormFromPayload(
      {
        groupMode: "HAS_GROUP",
        groupId: "group-1",
        groupStructure: {
          primaryGroupId: "group-1",
          ultimateParentAction: "UNCHANGED",
          relationships: [],
        },
      },
      undefined,
      { id: "client-1", isUltimateParentOfGroupId: "group-1" } as never
    );

    expect(form.isUltimateParent).toBeTruthy();
    expect(form.wasUltimateParent).toBeTruthy();
  });

  it("keeps legacy Group data out of a newly saved payload", () => {
    const form = clientMasterFormFromPayload({
      groupMode: "HAS_GROUP",
      groupId: "group-1",
      groupStructure: {
        primaryGroupId: "group-1",
        ultimateParentAction: "UNCHANGED",
        relationships: [
          {
            action: "UPSERT",
            relationshipId: "relationship-1",
            groupId: "group-2",
            type: "ASSOCIATE",
            direction: "TO_CLIENT",
            counterpartClientId: "client-2",
            effectiveFrom: "2026-01-01",
          },
        ],
      },
    });

    expect(buildClientPayload(form).groupStructure).toBeUndefined();
  });

  it("detects duplicate client identifiers while excluding the edited client", () => {
    const existingClient = {
      id: "client-1",
      clientCode: "C-001",
      companyCode: "HQ-001",
      companyIdentifierType: "COMPANY_REGISTRATION_NUMBER",
      companyNumber: "1234567",
    } as never;

    expect(
      validateClientIdentifiers(
        { clientCode: " c-001 ", companyNumber: "1234567" },
        [existingClient]
      )
    ).toStrictEqual({
      clientCode: "This Client Code is already in use.",
    });
    expect(
      validateClientIdentifiers(
        { clientCode: "C-001", companyNumber: "1234567" },
        [existingClient],
        "client-1"
      )
    ).toStrictEqual({});
    expect(
      validateClientIdentifiers(
        {
          clientCode: "C-002",
          companyCode: " hq-001 ",
          companyNumber: "9999999",
        },
        [existingClient]
      )
    ).toStrictEqual({ companyCode: "This Company Code is already in use." });
    expect(
      validateClientIdentifiers(
        {
          clientCode: "C-002",
          companyIdentifierType: "BUSINESS_REGISTRATION_NUMBER",
          companyNumber: "1234567",
        },
        [existingClient]
      )
    ).toStrictEqual({});
  });

  it("preserves legacy Service Type selections and hides removed detail fields", () => {
    const payload = buildClientPayload({
      ...EMPTY_CLIENT_MASTER_FORM,
      expectedJobOrEngagementType: "Annual audit",
      serviceType: "Tax",
      serviceLines: "Tax, Accounting, Audit",
      approvalReferenceNumber: "NCA-LEGACY-001",
      approvalDate: "2026-07-21",
      taxServiceDetails: "Legacy tax details",
      comSecServiceDetails: "Legacy company secretarial details",
      otherServiceDescription: "Legacy other service details",
    });

    expect(payload.expectedJobOrEngagementType).toBeUndefined();
    expect(payload.serviceType).toBe("Tax");
    expect(payload.serviceLines).toBe("Tax, Accounting Service, Audit");
    expect(payload).toStrictEqual(
      expect.objectContaining({
        approvalReferenceNumber: undefined,
        approvalDate: undefined,
        taxServiceDetails: undefined,
        comSecServiceDetails: undefined,
        otherServiceDescription: undefined,
      })
    );
  });

  it("loads legacy service values from Service Lines before the compatibility alias", () => {
    expect(parseClientServiceTypes("Audit, Tax", "Risk")).toStrictEqual([
      "Audit",
      "Tax",
    ]);
    expect(parseClientServiceTypes("", "Accounting")).toStrictEqual([
      "Accounting Service",
    ]);
    expect(serializeClientServiceTypes(["Risk", "Audit", "Com Sec"])).toBe(
      "Risk, Audit, Com Sec"
    );
  });

  it("serializes direct and multi-party group relationships without writing a legacy map", () => {
    const payload = buildClientPayload({
      ...EMPTY_CLIENT_MASTER_FORM,
      relatedEntities: [
        {
          draftKey: "party-1",
          kind: "COMPANY",
          displayName: "ABC HK Limited",
          jurisdiction: "Hong Kong",
          registrationNumber: "12345678",
          status: "ACTIVE",
        },
      ],
      relatedRelationships: [
        {
          draftKey: "rel",
          fromRef: { type: "ROOT" },
          toRef: { type: "DRAFT", draftKey: "party-1" },
          type: "OWNS",
          ownershipPercentage: 100,
        },
      ],
      relatedGroupRelationships: [
        {
          draftKey: "group-relationship-1",
          targetRef: { type: "ROOT" },
          type: "ASSOCIATE",
          participants: [
            {
              entityRef: { type: "DRAFT", draftKey: "party-1" },
              method: "OWNERSHIP",
              ownershipPercentage: null,
            },
          ],
        },
      ],
    });

    expect(payload.entityMap).toBeUndefined();
    expect(payload.relatedEntities).toHaveLength(1);
    expect(payload.relatedRelationships).toStrictEqual([
      expect.objectContaining({
        type: "OWNS",
        ownershipPercentage: 100,
      }),
    ]);
    expect(payload.relatedGroupRelationships).toStrictEqual([
      expect.objectContaining({
        type: "ASSOCIATE",
        participants: [
          expect.objectContaining({
            method: "OWNERSHIP",
            ownershipPercentage: null,
          }),
        ],
      }),
    ]);
  });

  it("round-trips an existing legacy Entity Map reference", () => {
    const payload = buildClientPayload({
      ...EMPTY_CLIENT_MASTER_FORM,
      entityMapChoice: "YES",
      entityMapId: "legacy-map-1",
      entityMapNodeId: "legacy-node-1",
    });

    expect(payload.entityMap).toStrictEqual({
      choice: "YES",
      mapId: "legacy-map-1",
      nodeId: "legacy-node-1",
    });
  });

  it("rejects future relationship dates before submission", () => {
    const errors = validateClientForm(
      {
        ...EMPTY_CLIENT_MASTER_FORM,
        clientCode: "C-001",
        nameEn: "Future Relationship Limited",
        status: "ACTIVE",
        groupMode: "HAS_GROUP",
        groupId: "group-1",
        clientPartnerPicId: "user-pic",
        groupRelationships: [
          {
            key: "new-1",
            relationshipId: "",
            action: "UPSERT",
            type: "ASSOCIATE",
            direction: "FROM_CLIENT",
            counterpartClientId: "client-2",
            ownershipPercentage: "",
            effectiveFrom: "2100-01-01",
            effectiveTo: "",
            remarks: "",
          },
        ],
      },
      { requiresRouting: false }
    );

    expect(errors["groupRelationships.0.effectiveFrom"]).toBe(
      "Relationship effective date cannot be in the future."
    );
  });

  it("requires dates and a primary Group for formal subsidiary proposals", () => {
    const errors = validateClientForm(
      {
        ...EMPTY_CLIENT_MASTER_FORM,
        clientCode: "C-001",
        nameEn: "Huaqian Limited",
        groupRelationships: [
          {
            key: "new-1",
            relationshipId: "",
            action: "UPSERT",
            type: "SUBSIDIARY",
            direction: "TO_CLIENT",
            counterpartClientId: "client-2",
            ownershipPercentage: "101",
            effectiveFrom: "",
            effectiveTo: "",
            remarks: "",
          },
        ],
      },
      { requiresRouting: false }
    );

    expect(errors["groupRelationships.0.type"]).toContain("primary Group");
    expect(errors["groupRelationships.0.effectiveFrom"]).toBe(
      "Effective date is required."
    );
    expect(errors["groupRelationships.0.ownershipPercentage"]).toContain(
      "between 0 and 100"
    );
  });
});
