import { describe, expect, it } from "vitest";

import { filterAndSortArchives } from "./archive-list-utils";

const archives = [
  {
    id: "archive-1",
    engagementId: "engagement-1",
    engagementCode: "AUD-2026-018",
    clientName: "华南科技有限公司",
    reportDate: "2026-05-10",
    pic: "李明",
    archivedAt: "2026-05-20T10:24:00.000Z",
    totals: {
      currency: "HKD",
      budgetCost: "1260000.00",
      actualCost: "1198450.00",
    },
  },
  {
    id: "archive-2",
    engagementId: "engagement-2",
    engagementCode: "CON-2025-009",
    clientName: "华东电子股份有限公司",
    reportDate: "2025-04-28",
    pic: "王磊",
    archivedAt: "2025-05-18T16:43:00.000Z",
    totals: {
      currency: "HKD",
      budgetCost: "980000.00",
      actualCost: "1003200.00",
    },
  },
];

describe("filterAndSortArchives", () => {
  it("filters by a selected archive year", () => {
    expect(
      filterAndSortArchives(archives, "", "2025", "archivedAt").map(
        (item) => item.id
      )
    ).toEqual(["archive-2"]);
  });

  it("finds an archive by client, project code, or PIC", () => {
    expect(
      filterAndSortArchives(archives, "王磊", "all", "archivedAt").map(
        (item) => item.id
      )
    ).toEqual(["archive-2"]);
    expect(
      filterAndSortArchives(archives, "AUD-2026", "all", "archivedAt").map(
        (item) => item.id
      )
    ).toEqual(["archive-1"]);
  });

  it("sorts deterministically by client name", () => {
    expect(
      filterAndSortArchives(archives, "", "all", "clientName").map(
        (item) => item.id
      )
    ).toEqual(["archive-2", "archive-1"]);
  });
});
