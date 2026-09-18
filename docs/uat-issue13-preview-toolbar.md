# Issue 13: narrow PDF preview toolbar

The shared document-toolbar CSS forced wrapping even though the EMP PDF toolbar requested a single row. The PDF toolbar now explicitly keeps both control groups on one row and measures its own container width.

Below 700px, page navigation uses a compact `1 / N` label and secondary actions (search, annotations when available, and preview window actions) move into the existing PDF actions menu. Below 440px, zoom step buttons are omitted; the zoom selector retains all percentages and fit modes. Wide panes retain the existing controls.

## Verification

- Local mock application: `http://127.0.0.1:3033/zh-CN/engagement/project-orchid-2026`.
- Interactive path: `Preview bank confirmation.pdf` file actions → Preview, with the application's PDF viewer enabled in Personalization.
- Real browser measurements at 638px and 454px preview widths showed a 48px toolbar and no horizontal overflow. Captured and visually inspected the single-row toolbar screenshot.
- Opened the compact actions menu, opened Search and entered `bank`, and changed zoom from Fit width to 100%. All were reachable and reflected the requested state.
- Browser viewport overrides were reset after responsive checks. Browser viewport controls have an effective minimum width, so the below-440px variant was not visually verified.
- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/extend/pdf-viewer-layout.test.ts`: 4 tests passed.
- `corepack pnpm --filter @project-wing/emp lint`: passed (TypeScript).
- `oxfmt apps/emp/src/components/extend/pdf-viewer.tsx --config oxfmt.config.ts`: completed using Node 24.
- `git diff --check`: passed.

This is local UI verification with mock project data. No backend mutation, live deployment, or complete application test suite was run for Issue 13.
