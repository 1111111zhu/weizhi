import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const puckEditorSource = readFileSync(
  new URL("smart-form-v2-puck-editor.tsx", import.meta.url),
  "utf-8"
);

describe("smartForm designer runtime preview", () => {
  it("compiles the current authored definition and mounts the real entry runtime", () => {
    expect(puckEditorSource).toContain("onPreview: headerActions");
    expect(puckEditorSource).toMatch(
      /compileSmartFormV2Definition\(\s*definition,\s*STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY\s*\)/
    );
    expect(puckEditorSource).toContain("setRuntimePreviewDefinition(");
    expect(puckEditorSource).toMatch(
      /<SmartFormV2Editor[\s\S]*definition=\{definition\}[\s\S]*copy=\{dictionary\.smartFormV2Editor\}/
    );
  });
});
