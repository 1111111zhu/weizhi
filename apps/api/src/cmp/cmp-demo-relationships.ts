export type CmpDemoRelationship = readonly [
  id: string,
  groupCode: string,
  fromClientId: string,
  toClientId: string,
  type: "SUBSIDIARY" | "ASSOCIATE" | "JOINT_VENTURE",
  ownershipPercentage: string,
  effectiveFrom: string,
  remarks: string,
];

export function buildCmpDemoRelationships(
  resolveClientId: (clientCode: string) => string
): CmpDemoRelationship[] {
  const [jointVentureFromId, jointVentureToId] = [
    resolveClientId("DEMO-BETA-HOLD"),
    resolveClientId("DEMO-GAMMA-HOLD"),
  ].sort();

  return [
    [
      "seed-cmp-rel-alpha-ops",
      "DEMO-GROUP-ALPHA",
      resolveClientId("DEMO-ALPHA-HOLD"),
      resolveClientId("DEMO-ALPHA-OPS"),
      "SUBSIDIARY",
      "100.00",
      "2026-01-01",
      "Direct operating subsidiary demo",
    ],
    [
      "seed-cmp-rel-alpha-digital",
      "DEMO-GROUP-ALPHA",
      resolveClientId("DEMO-ALPHA-OPS"),
      resolveClientId("DEMO-ALPHA-DIGI"),
      "SUBSIDIARY",
      "75.00",
      "2026-02-01",
      "Second-level subsidiary demo",
    ],
    [
      "seed-cmp-rel-beta-cloud",
      "DEMO-GROUP-BETA",
      resolveClientId("DEMO-BETA-HOLD"),
      resolveClientId("DEMO-BETA-CLOUD"),
      "SUBSIDIARY",
      "80.00",
      "2026-03-01",
      "Technology subsidiary demo",
    ],
    [
      "seed-cmp-rel-alpha-beta-associate",
      "DEMO-GROUP-ALPHA",
      resolveClientId("DEMO-ALPHA-HOLD"),
      resolveClientId("DEMO-BETA-HOLD"),
      "ASSOCIATE",
      "25.00",
      "2026-04-01",
      "Cross-Group associate demo",
    ],
    [
      "seed-cmp-rel-beta-gamma-jv",
      "DEMO-GROUP-BETA",
      jointVentureFromId,
      jointVentureToId,
      "JOINT_VENTURE",
      "50.00",
      "2026-05-01",
      "Cross-Group joint venture demo",
    ],
  ];
}
