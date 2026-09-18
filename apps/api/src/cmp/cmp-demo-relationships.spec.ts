import { describe, expect, it } from "vitest";

import { buildCmpDemoRelationships } from "./cmp-demo-relationships";

describe(buildCmpDemoRelationships, () => {
  it("builds distinct relationship endpoints and canonical joint venture order", () => {
    const clientIds = new Map([
      ["DEMO-ALPHA-HOLD", "client-alpha-hold"],
      ["DEMO-ALPHA-OPS", "client-alpha-ops"],
      ["DEMO-ALPHA-DIGI", "client-alpha-digital"],
      ["DEMO-BETA-HOLD", "client-beta-hold"],
      ["DEMO-BETA-CLOUD", "client-beta-cloud"],
      ["DEMO-GAMMA-HOLD", "client-gamma-hold"],
    ]);
    const relationships = buildCmpDemoRelationships((clientCode) => {
      const clientId = clientIds.get(clientCode);
      if (!clientId) {
        throw new Error(`Missing test client ${clientCode}`);
      }
      return clientId;
    });

    expect(relationships).toHaveLength(5);
    for (const relationship of relationships) {
      expect(relationship[2]).not.toBe(relationship[3]);
    }

    const jointVenture = relationships.find(
      (relationship) => relationship[4] === "JOINT_VENTURE"
    );
    expect(jointVenture?.[2]).toBe("client-beta-hold");
    expect(jointVenture?.[3]).toBe("client-gamma-hold");
  });
});
