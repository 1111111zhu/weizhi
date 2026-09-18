import assert from "node:assert/strict";

import { describe, afterEach, test, vi } from "vitest";

const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH;

function loadRoutes(basePath?: string) {
  vi.resetModules();
  if (basePath === undefined) {
    delete process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH;
  } else {
    process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH = basePath;
  }
  return import("./routes");
}

describe("constants/routes contracts", () => {
  afterEach(() => {
    if (ORIGINAL_BASE_PATH === undefined) {
      delete process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH = ORIGINAL_BASE_PATH;
    }
  });

  test("adds and removes a configured base path exactly once", async () => {
    const routes = await loadRoutes("/showroom/");
    assert.equal(
      routes.withShowroomBasePath("/docs/installation"),
      "/showroom/docs/installation"
    );
    assert.equal(
      routes.withShowroomBasePath("/showroom/docs/installation"),
      "/showroom/docs/installation"
    );
    assert.equal(
      routes.withoutShowroomBasePath("/showroom/docs/installation.md"),
      "/docs/installation.md"
    );
    assert.equal(routes.withoutShowroomBasePath("/showroom"), "/");
  });

  test("keeps routes unchanged without a base path", async () => {
    const routes = await loadRoutes();
    assert.equal(
      routes.withShowroomBasePath("/docs/installation"),
      "/docs/installation"
    );
    assert.equal(
      routes.withoutShowroomBasePath("/docs/installation.md"),
      "/docs/installation.md"
    );
  });
});
