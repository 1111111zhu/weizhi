import { beforeEach, describe, expect, it } from "vitest";
// @vitest-environment happy-dom

import { getCmpDictionary } from "@/i18n/client";

import { createInitialMaps } from "./cmp-map-preview-data";
import { loadMaps, saveMaps } from "./cmp-map-storage";

const initialMaps = createInitialMaps(getCmpDictionary("en-US").mapPlane);

describe("cMP Map prototype storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses the supplied maps when no browser draft exists", () => {
    expect(loadMaps(initialMaps)).toStrictEqual(initialMaps);
  });

  it("persists entity positions and Client designations", () => {
    const maps = structuredClone(initialMaps);
    maps[0].nodes[1].position = { x: 120, y: 340 };
    maps[0].nodes[1].data.isClient = true;

    saveMaps(maps);

    expect(loadMaps(initialMaps)[0].nodes[1]).toMatchObject({
      position: { x: 120, y: 340 },
      data: { isClient: true },
    });
  });

  it("recovers from malformed browser data", () => {
    window.localStorage.setItem("cmp-entity-maps-v2", "not-json");
    expect(loadMaps(initialMaps)).toStrictEqual(initialMaps);
  });
});
