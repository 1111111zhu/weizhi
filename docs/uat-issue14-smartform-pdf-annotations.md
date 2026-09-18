# Issue 14: SmartForm PDF review-note positions

Row review annotations fell back to the top of the first PDF page because Typst query coordinates were serialized as strings such as `326.4pt`; numeric conversion rejected those lengths. The renderer now explicitly emits numeric point coordinates. Group-row anchors are placed inside their spanning table cell, and non-row anchors follow the current vertical flow. This matches the placement semantics in [Typst's documentation](https://typst.app/docs/reference/layout/place/).

Review icons now use one right-margin column with minimal vertical collision avoidance. The subsequent grouped-note update combines same-row questions into one standard native annotation with their complete discussions, localizes labels from the SmartForm language, and uses preview renderer version 6 to invalidate older cached PDFs. See `uat-smartform-grouped-notes.md` for the updated verification.

## Evidence

The real SmartForm PDF service compiled the Deferred Income fixture with notes on rows 1, 2 (group), 2(a), 2(b), and the final procedure on a later page. PDF.js extracted row text positions independently of the anchor metadata. Regression checks compare annotation positions with those text positions, verify multiple pages, and reject overlapping icons.

- `corepack pnpm --filter @project-wing/api exec vitest run src/smart-forms/smart-form-v2-pdf.service.spec.ts src/workflow/workflow.service.spec.ts`: 192 tests passed.
- `corepack pnpm --filter @project-wing/api lint`: passed.
- `oxfmt apps/api/src/smart-forms/smart-form-v2-pdf.service.ts apps/api/src/smart-forms/smart-form-v2-pdf.service.spec.ts apps/api/src/workflow/workflow.service.ts --config oxfmt.config.ts`: completed using Node 24.
- `git diff --check`: passed.
- Generated `apps/api/output/pdf/issue14-row-annotations.pdf` with the real compiler and rendered pages 1–2 using `pdftoppm -f 1 -l 2 -scale-to 1300 -png apps/api/output/pdf/issue14-row-annotations.pdf apps/api/output/pdf/issue14-row-annotations`. Visually inspected the page images, including adjacent rows and the later-page note.

No production deployment or authenticated export through the live UI was performed. The local mock UI does not exercise this backend renderer. Verification uses the real renderer, native annotation objects, independent PDF text extraction, and rendered page images.
