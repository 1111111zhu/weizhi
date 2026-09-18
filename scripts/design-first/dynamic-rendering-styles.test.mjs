import assert from "node:assert/strict";
import test from "node:test";

import { analyzeSourceFile } from "./boundary-source-analysis.mjs";

const workbench =
  "apps/emp/src/components/confirmations/confirmation-template-workbench.tsx";
const editor =
  "apps/emp/src/components/confirmations/project-confirmation-editor.tsx";

test("permits document coordinates and authored text without allowing nearby app styling", () => {
  const result = analyzeSourceFile(
    workbench,
    `function Preview() { return <>
    <div style={{left: \`\${field.x * 100}%\`, ...getConfirmationTemplateFieldTextStyleCss(field.textStyle)}} />
    <div style={{borderRadius: 99}} />
    <div style={{...textStyle, boxShadow: "0 0 10px red"}} />
    </>; }`
  );
  assert.equal(
    result.filter((finding) => finding.rule === "no-restricted-syntax").length,
    2
  );
});

test("does not classify a document-looking identifier on an unrelated product screen", () => {
  const result = analyzeSourceFile(
    "apps/cmp/src/components/new-page.tsx",
    "function Page() { return <div style={textStyle} />; }"
  );
  assert.ok(result.some((finding) => finding.rule === "no-restricted-syntax"));
});

test("limits popup positioning to the real linked-field adapter", () => {
  assert.equal(
    analyzeSourceFile(
      editor,
      "function LinkedTemplateFieldInput() { return <div style={popupPosition} />; }"
    ).length,
    0
  );
  assert.ok(
    analyzeSourceFile(
      editor,
      "function UnrelatedCard() { return <div style={popupPosition} />; }"
    ).length > 0
  );
});

test("keeps hardcoded colors rejected even alongside authored values", () => {
  const result = analyzeSourceFile(
    workbench,
    'function Preview() { return <div style={{ backgroundColor: selectionTextStyle.backgroundColor ?? "#abcdef" }} />; }'
  );
  assert.ok(result.some((finding) => finding.rule === "no-restricted-syntax"));
});

test("allows measured progress but rejects unrelated or static replacements", () => {
  const file = "apps/cmp/src/components/cmp-billing-page.tsx";
  assert.equal(
    analyzeSourceFile(
      file,
      'function Chart() { return <div style={{ "--cmp-billing-donut-offset": 100 - visualPercent }} />; }'
    ).length,
    0
  );
  assert.ok(
    analyzeSourceFile(
      file,
      'function Chart() { return <div style={{ "--cmp-billing-donut-offset": 20 }} />; }'
    ).length > 0
  );
  assert.ok(
    analyzeSourceFile(
      file,
      "function Chart() { return <div style={{ borderRadius: visualPercent }} />; }"
    ).length > 0
  );
});
