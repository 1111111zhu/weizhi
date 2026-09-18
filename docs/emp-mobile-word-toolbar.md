# Mobile Word preview toolbar — 2026-09-12

## Scope and behavior

The actual EMP DOCX preview now has a mobile-only toolbar branch: thumbnails, previous page, current/total page with direct page entry, next page, search and more. Duplicate file identity and separators are omitted on phones. Desktop retains its original toolbar; PDF/PPT and global toolbar wrapping CSS are unchanged.

Existing zoom, comments, edits, optional pan/selection/night mode, upload/download and injected preview actions remain available in the Document tools bottom sheet. Selecting numeric zoom on mobile exits automatic width fitting; Fit width restores the original fit calculation. Manual mode is cleared across documents and when leaving mobile layout. No document layout/parser algorithm was replaced.

`DocumentTextSearchPopover` accepts an optional `mobilePresentation="sheet"`, used only by mobile DOCX. Default callers still receive the existing popover. Existing search and result navigation state are reused. Labels retain the viewer's existing English defaults rather than adding locale-provider requirements to detached and standalone previews. All mobile surfaces reuse Material tokens and MobileActionSheet.

## Validation

Worktree: `D:/Project_wing/.worktrees/mobile-app-experience`; bundled Node 24.19.0.

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/extend/docx-toolbar.test.tsx src/components/extend/docx-viewer.test.ts src/components/extend/document-text-search-popover.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/components/extend/docx-viewer.tsx apps/emp/src/components/extend/docx-mobile-toolbar.module.css apps/emp/src/components/extend/document-text-search-popover.tsx apps/emp/src/components/extend/document-text-search-popover.module.css apps/emp/src/components/extend/docx-toolbar.test.tsx apps/emp/src/components/extend/document-text-search-popover.test.tsx
node scripts/design-first/cli.mjs validate-registry
```

13 tests passed. Coverage includes page-store navigation, bounded direct entry, loading/disabled state, optional action visibility, zoom/view callbacks, injected actions, search cycling/clear/reopen, and default desktop/popover behavior. Typecheck, scoped lint/formatting and registry validation passed. A final CSS-only 44px menu-target adjustment passed `corepack pnpm exec oxfmt --check apps/emp/src/components/extend/docx-mobile-toolbar.module.css`.

Playwright used the actual local Mock app on port 3048: engagement → default folder → Orchid → Planning → Client acceptance or continuance → A1-1000 → Preview bank confirmation.docx. The phone toolbar measured 52px high, with 44px controls and a 48px page button. Next page reached page 2; direct entry reached page 3. Numeric 100% zoom changed the document surface from ~342px to ~794px wide, and Fit width restored ~342px. Searching `bank` showed 1/4 results and advanced to 2/4; the query was cleared after checking. Desktop reopened through the existing file menu's Preview action, confirming the full zoom controls and absence of mobile toolbar. At 320px the document scroll width remained 320px, and toolbar width/scroll width both measured 294px. The existing dark theme was visually checked after the document page finished rendering; the document remains readable on its paper surface.

Screenshots under `output/playwright/`:

- `emp-word-mobile-toolbar.png`
- `emp-word-mobile-320.png`
- `emp-word-mobile-dark.png`
- `emp-word-mobile-tools.png`
- `emp-word-mobile-search.png`
- `emp-word-desktop-toolbar.png`

No file was uploaded/downloaded or opened in native Office during acceptance. Not run: production build, full repository/workbench test suites, backend-attached or Android-native keyboard acceptance. The existing unavailable local Desktop Agent manifest endpoint still reports a console error. No deployment was performed.
