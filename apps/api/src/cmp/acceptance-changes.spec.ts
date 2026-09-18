import { buildAcceptanceChangeSummary } from "./acceptance-changes";

describe(buildAcceptanceChangeSummary, () => {
  it("groups Client master changes", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "CLIENT_CHANGE",
      baseline: {
        clientCode: "C001",
        nameEn: "Original Limited",
        address: "Old address",
      },
      proposed: {
        clientCode: "C001",
        nameEn: "Updated Limited",
        address: "",
      },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary).toMatchObject({
      status: "AVAILABLE",
      changedFieldCount: 2,
      staleMasterData: false,
    });
    expect(summary.groups).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "basicInformation",
          changes: expect.arrayContaining([
            expect.objectContaining({
              field: "nameEn",
              kind: "MODIFIED",
              before: "Original Limited",
              after: "Updated Limited",
            }),
            expect.objectContaining({
              field: "address",
              kind: "REMOVED",
              before: "Old address",
              after: null,
            }),
          ]),
        }),
      ])
    );
  });

  it("returns responsible users by display name while comparing their IDs", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "ENGAGEMENT_CHANGE",
      baseline: { picUserId: "pic-1", pic: "Old Partner" },
      proposed: { picUserId: "pic-2", pic: "New Partner" },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: true,
    });

    expect(summary).toMatchObject({
      changedFieldCount: 1,
      staleMasterData: true,
      groups: [
        {
          section: "riskClassificationAndResponsiblePersons",
          changes: [
            {
              field: "pic",
              kind: "MODIFIED",
              before: "Old Partner",
              after: "New Partner",
            },
          ],
        },
      ],
    });
  });

  it("reports contact-list edits as one structured Client change", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "CLIENT_CHANGE",
      baseline: {
        contactPerson: "Cathy Ho",
        contacts: [{ name: "Cathy Ho", email: "cathy@example.com" }],
      },
      proposed: {
        contactPerson: "Cathy Ho",
        contacts: [
          { name: "Cathy Ho", email: "cathy@example.com" },
          { name: "Alex Chan", email: "alex@example.com" },
        ],
      },
      baselineCapturedAt: new Date("2026-08-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary.changedFieldCount).toBe(1);
    expect(summary.groups[0]?.changes[0]).toMatchObject({
      field: "contacts",
      kind: "MODIFIED",
    });
  });

  it("returns an explicit unavailable state instead of estimating history", () => {
    expect(
      buildAcceptanceChangeSummary({
        type: "CLIENT_CHANGE",
        baseline: null,
        proposed: { nameEn: "Updated Limited" },
        baselineCapturedAt: null,
        staleMasterData: false,
      })
    ).toStrictEqual({
      status: "BASELINE_UNAVAILABLE",
      changedFieldCount: 0,
      baselineCapturedAt: null,
      staleMasterData: false,
      groups: [],
    });
  });

  it("allows a no-op Change summary", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "ENGAGEMENT_CHANGE",
      baseline: { engagementCode: "ENG-001", agreedFee: "100.00" },
      proposed: { engagementCode: "ENG-001", agreedFee: "100.00" },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary.changedFieldCount).toBe(0);
    expect(summary.groups).toStrictEqual([]);
  });

  it("compares Engagement commercial values by numeric meaning", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "ENGAGEMENT_CHANGE",
      baseline: {
        engagementCode: "ENG-001",
        budgetedHours: "200",
        agreedFee: "200.0",
        recoveryRate: 20,
      },
      proposed: {
        engagementCode: "ENG-001",
        budgetedHours: "200.00",
        agreedFee: "200.00",
        recoveryRate: "20.00",
      },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary.changedFieldCount).toBe(0);
  });

  it("shows deliverable additions, removals and descriptions individually", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "ENGAGEMENT_CHANGE",
      baseline: {
        deliverables: [
          {
            key: "AUDITORS_REPORT",
            category: "ANNUAL_AUDIT",
            code: "AUDITORS_REPORT",
            sortOrder: 0,
          },
          {
            key: "custom-1",
            category: "OTHERS",
            code: "CUSTOM",
            description: "Initial custom report",
            sortOrder: 1,
          },
        ],
      },
      proposed: {
        deliverables: [
          {
            key: "AUDITORS_REPORT",
            category: "ANNUAL_AUDIT",
            code: "AUDITORS_REPORT",
            sortOrder: 9,
          },
          {
            key: "custom-1",
            category: "OTHERS",
            code: "CUSTOM",
            description: "Updated custom report",
            sortOrder: 0,
          },
          {
            key: "CONSENT_LETTER",
            category: "SPECIAL_ENGAGEMENT",
            code: "CONSENT_LETTER",
            sortOrder: 1,
          },
        ],
      },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary.groups).toStrictEqual([
      expect.objectContaining({
        section: "reportsAndDeliverables",
        changes: expect.arrayContaining([
          expect.objectContaining({
            field: "deliverables.CONSENT_LETTER",
            kind: "ADDED",
            before: null,
            after: true,
          }),
          expect.objectContaining({
            field: "deliverables.CUSTOM:custom-1",
            kind: "MODIFIED",
            before: "Initial custom report",
            after: "Updated custom report",
          }),
        ]),
      }),
    ]);
    expect(summary.changedFieldCount).toBe(2);
  });

  it("keeps precision when comparing large decimal values", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "ENGAGEMENT_CHANGE",
      baseline: { agreedFee: "9007199254740992.00" },
      proposed: { agreedFee: "9007199254740993.00" },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary.changedFieldCount).toBe(1);
    expect(summary.groups[0]?.changes[0]).toMatchObject({
      before: "9007199254740992",
      after: "9007199254740993",
    });
  });

  it("distinguishes responsible users who have the same name", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "ENGAGEMENT_CHANGE",
      baseline: { picUserId: "pic-1", pic: "John Lee" },
      proposed: { picUserId: "pic-2", pic: "John Lee" },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
      displayLookup: new Map([
        ["user:pic-1", "John Lee (john.one@example.com)"],
        ["user:pic-2", "John Lee (john.two@example.com)"],
      ]),
    });

    expect(summary.groups[0]?.changes[0]).toMatchObject({
      before: "John Lee (john.one@example.com)",
      after: "John Lee (john.two@example.com)",
    });
  });

  it("compares the complete Client Service Type selection", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "CLIENT_CHANGE",
      baseline: {
        serviceType: "Audit",
        serviceLines: "Audit, Tax",
      },
      proposed: {
        serviceType: "Audit",
        serviceLines: "Audit, Risk",
      },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
    });

    expect(summary.changedFieldCount).toBe(1);
    expect(summary.groups.flatMap((group) => group.changes)).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "serviceLines" }),
      ])
    );
  });

  it("shows primary Group and relationship changes as structured records", () => {
    const summary = buildAcceptanceChangeSummary({
      type: "CLIENT_CHANGE",
      baseline: {
        groupStructure: {
          primaryGroupId: "group-1",
          ultimateParentAction: "UNCHANGED",
          relationships: [],
        },
      },
      proposed: {
        groupStructure: {
          primaryGroupId: "group-1",
          ultimateParentAction: "SET_CURRENT",
          relationships: [
            {
              action: "UPSERT",
              type: "SUBSIDIARY",
              direction: "FROM_CLIENT",
              counterpartClientId: "client-2",
              ownershipPercentage: 80,
              effectiveFrom: "2026-07-21",
            },
          ],
        },
      },
      baselineCapturedAt: new Date("2026-07-20T10:00:00.000Z"),
      staleMasterData: false,
      displayLookup: new Map([
        ["group:group-1", "G001 - Huaqian Group"],
        ["client:client-2", "C002 - Subsidiary Limited"],
      ]),
    });

    expect(summary.groups).toStrictEqual([
      expect.objectContaining({
        section: "groupRelationship",
        changes: [
          expect.objectContaining({
            field: "groupStructure",
            kind: "MODIFIED",
            after: expect.arrayContaining([
              expect.objectContaining({
                primaryGroup: "G001 - Huaqian Group",
              }),
              expect.objectContaining({
                relatedClient: "C002 - Subsidiary Limited",
                ownershipPercentage: 80,
              }),
            ]),
          }),
        ],
      }),
    ]);
  });
});
