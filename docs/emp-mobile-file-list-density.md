# EMP mobile file-list density correction — 2026-09-12

## Scope

Actual EMP application, not a specimen. Reuses the existing Material 3 tokens and MobileListItem; application-specific composition stays in EMP. Desktop rules, API calls, permissions, signoff callbacks and table column definitions are unchanged.

- One continuous list surface instead of alternating white cards and action blocks.
- File title and native file-type icon above a shared reference / notes / P / R row.
- Removed redundant preview chevrons and display-only empty-signature dashes on mobile.
- Notes retain their open/closed semantic colors with a message icon and count.
- File actions, notes and signature buttons retain 44px targets; signature hover uses the existing state layer rather than a solid background that obscures its label.
- Existing signer avatars and removal actions are retained. Rows wrap when needed.

## Verification

Commands run in `D:/Project_wing/.worktrees/mobile-app-experience`, using the bundled Node 24.19.0 runtime prepended to PATH:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'uses the mobile file list' --maxWorkers=1
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-color-palette.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/workbench-content.test.tsx apps/emp/src/components/emp-mobile-navigation.css
node scripts/design-first/cli.mjs validate-registry
```

Results: 187 component tests passed; the strengthened mobile regression passed separately (186 unselected). All 9 mobile CSS/theme contract tests passed. Typecheck, scoped formatting/lint and registry validation passed. Final CSS-only format check passed; the JS linter reports no applicable files for a CSS-only input.

Playwright session `emp-live-mobile`: local Mock EMP on `http://127.0.0.1:3048/zh-CN/engagement`, default folder → Orchid → Planning → Client acceptance or continuance → A1-1000. Opened and dismissed review notes. 320px document scroll width is 320px; all four row controls measure approximately 44 × 44 CSS pixels. At 1440px the mobile list is absent and the desktop table remains. Dark appearance was checked by applying the application's existing `.dark` class in the QA browser and removing it afterwards.

Screenshots in `output/playwright/`: `emp-file-list-compact.png`, `emp-file-list-compact-320.png`, `emp-file-list-compact-dark.png`, and `emp-file-list-compact-desktop.png`.

Not run: full repository tests, production build, backend-attached or Android interactive acceptance, and real signing/upload/deletion. Existing unavailable Desktop Agent manifest request remains a console error in this local environment.

## Follow-up: reduce signoff emphasis

Subsequent user feedback rejected large filled signature buttons. The current mobile-only CSS uses 32px visible button faces inside unchanged 44px targets, soft semantic tints, an 8px radius, no elevation, closer signer avatars, reduced row spacing and lighter separators. Row, title and metadata backgrounds are explicitly the same in both themes. No signing logic or desktop styles changed.

Current revision verification:

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/emp-mobile-navigation.css
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-color-palette.test.ts --maxWorkers=1
```

Formatting passed; CSS has no applicable JavaScript lint rules. All 9 tests passed. Playwright on the same actual local Mock EMP path verified 390px light appearance, 320px layout without document overflow, the existing dark theme class, and hover. Screenshots: `emp-files-refined-light.png`, `emp-files-refined-320.png`, `emp-files-refined-dark.png` in `output/playwright/`. Component tests, typecheck and production build were not rerun for this CSS-only follow-up. Android and real signoff mutations were not exercised.
