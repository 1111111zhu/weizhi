# SmartForm grouped PDF review notes

Same-row questions share one standard PDF Text annotation with the standard Comment icon. Custom appearance streams have been removed after the user observed broken-image placeholders in an ordinary reader. The grouped question count remains in the localized annotation title. There is no custom image, icon font, or appearance stream dependency.

Markers are sorted by their target page and vertical position, and aligned to one fixed right-margin column. Close rows use a 24pt minimum icon separation; a backwards pass shifts the cluster up when needed at the bottom margin. Rows no longer alternate between two horizontal lanes.

Opening the note shows the localized row description, status totals, and chronological Q1/Q2/etc. sections with author, date, complete question/reply text, attachments and references. Untargeted questions remain separate. An open question takes precedence in the group's fallback status color, followed by replied, then resolved.

Locale resolution uses the explicit SmartForm export language, then response language, then definition default. Fixed-row labels are resolved again from the definition in that language rather than reusing a stale label stored when a Q was created. User-written content remains unchanged. Preview renderer version 6 prevents reusing PDFs with custom appearances or staggered columns.

## Verification

- `corepack pnpm --filter @project-wing/api exec vitest run src/smart-forms/smart-form-v2-pdf.service.spec.ts src/workflow/workflow.service.spec.ts`: 194 passed.
- After replacing an ES2023-only array helper in the test for the API's target library, reran `corepack pnpm --filter @project-wing/api exec vitest run src/smart-forms/smart-form-v2-pdf.service.spec.ts`: 11 passed.
- `corepack pnpm --filter @project-wing/api lint`: passed.
- Regression tests cover same-row grouping, twelve complete discussions in one annotation, English/Chinese response languages, stale label replacement, chronology, actual text-position alignment across pages and locked annotation flags.
- Regenerated English and Chinese PDFs through the real renderer with three questions on row 2(a), then rendered pages 1–2 with `pdftoppm -f 1 -l 2 -scale-to 1300 -png`. Inspected both first-page images: standard comment icons render without broken-image placeholders, in a single column, with one icon for row 2(a). Both rendering commands exited 0 with no warnings. Regression checks require no AP entry, standard Text/Comment names, a shared x coordinate, descending reading order and at least 24pt separation.
- Read the exported annotations independently through PDF.js and confirmed the translated titles, status labels, target rows and all three questions.

Latest artifacts: `apps/api/output/pdf/smartform-compatible-notes-en-US.pdf` and `apps/api/output/pdf/smartform-compatible-notes-zh-CN.pdf` (local generated files).

No live deployment or authenticated UI export was run. PDF.js annotation parsing and Poppler page rendering passed; every third-party reader was not tested. Native PDF readers retain control of icon and popup chrome. Structured localized text and standard annotations are used for portability.
