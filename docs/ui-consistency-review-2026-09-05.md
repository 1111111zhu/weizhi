# UI consistency review — 2026-09-05

## Second pass: navigation availability and truthful list feedback

Continuing under the user's instruction to prioritize serious issues. Browser inspection at approximately 640px showed the confirmation rail occupying almost half the available work area. Source inspection found a blank failed confirmation workspace, an indistinguishable empty/failed user list and a recycle-bin fetch that converted failures into empty arrays.

- Added shared `ViewSwitcher` and `CollectionState` patterns. Confirmations use compact navigation below the desktop breakpoint. Intranet uses compact system links and category/subcategory selectors instead of stacking or squeezing large rails. Wide layouts retain the existing rails and resizing.
- The EMP account control and user search remain reachable in narrow layouts.
- User administration, confirmation center, information library, response warehouse and Intranet recycle bin distinguish loading, failure and empty results. Failed requests expose a retry action. Counts and pagination are suppressed while the result is unknown.
- Recycle-bin requests ignore late responses after leaving the view; returning home clears obsolete directory filters.
- The information library keeps its creation action visible outside overflow. Response-warehouse pagination is integrated into the shared frame.
- The confirmation overview labels its row count as projects, distinguishing it from the navigation's total confirmation count.

- Browser review also exposed a user-search crash: the state updater read `event.currentTarget.value` after the event had finished. Search now snapshots the value synchronously; successive search inputs have regression coverage.

### Second-pass verification

All commands ran in `.worktrees/saas-ui-consistency-pass`. Final formatting and builds used bundled Node 24.19. Browser review used the existing development API through localhost:3010, not mocked product data. Screenshots were captured in this task. Tested confirmation compact navigation and information-library selection, Intranet QM → Technical → Audit category selection (including a measured 641px viewport with no page-level horizontal overflow), and user search for `Jony` plus clearing the search. The native EMP browser width was 972px during final inspection. The shared specimen separately exercised error → retry → empty and keyboard Enter/ArrowDown/Enter selection with focus returned to the trigger. This specimen simulates state changes; product failure/retry behavior is covered by the integration tests below. Temporary viewport overrides were reset.

| Command | Current result |
| --- | --- |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/views/admin-users.test.tsx src/views/confirmations.test.tsx src/components/project-wing-top-bar-controls.test.tsx` | 31 tests passed before the additional search regression |
| `pnpm --filter @project-wing/emp exec vitest run src/views/admin-users.test.tsx src/components/confirmations/confirmation-information-library.test.tsx` | Final 27 tests passed, including successive search inputs and retry |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-information-library.test.tsx src/components/confirmation-response-warehouse.test.tsx` | Initial 46 passed, 1 asynchronous option-query failure; the information-library test now waits for the same options and its full suite passed in the command above; response warehouse's 28 tests passed |
| `corepack pnpm --filter @project-wing/intranet exec vitest run src/app/page-client.test.tsx` | Final 17 tests passed, including archive failure/retry |
| `pnpm --filter @project-wing/ui test` | Final 74 tests passed across 17 files |
| `pnpm --filter @project-wing/ui --filter @project-wing/emp --filter @project-wing/intranet --filter @project-wing/ui-showroom lint` | All four typechecks passed |
| `pnpm --filter @project-wing/emp build` | Passed |
| `pnpm --filter @project-wing/intranet build` | Passed |
| `pnpm --filter @project-wing/ui-showroom build` | Passed; existing dynamic PDF-font filesystem tracing warning remains |
| `node scripts/design-first/cli.mjs validate-registry` | Passed; new patterns are experimental, not blanket-approved |
| `node scripts/design-first/cli.mjs audit --json` | Not clean: 103 existing unexpected findings, unchanged from the first-pass baseline. Two existing static-copy findings are now in a touched file, `confirmation-information-library.tsx`; no baseline allowances were added |
| `git diff --check` | Passed |

No root-wide test run, remote deployment, PR/merge, destructive account action, or exhaustive all-page/mobile acceptance was performed. Wide rails remain in the implementation; the final native browser was below the desktop breakpoint, so it does not constitute a fresh wide-desktop acceptance run.

Status: implemented and reviewed locally. The user authorized autonomous UI optimization this morning and waived iterative guidance. This is not blanket approval of the entire design-system registry.

## Direction and priority

Use the existing ProjectWing neutral surfaces, green action color and component boundary. Reference: the supplied ServiceNow screenshot and [Horizon workspace structure](https://horizon.servicenow.com/workspace/basics/structure). Apply stable navigation, clear work areas, quiet supporting metadata and recognizable actions. Do not add synthetic metrics or change business permissions.

| Priority | Observed problem | Implementation |
| --- | --- | --- |
| 1 | Shared grid toolbar parses CSS `16px` with `Number`, producing NaN and disabling overflow detection | Parse computed padding; observe changing content widths; preserve an explicit primary action outside overflow |
| 1 | A pagination button for every page makes large datasets overflow | Bounded page window, first/last access, ellipses, labelled previous/next icons |
| 1 | Grid body and separate footer have an internal rounded seam | Shared footer slot; integrated and custom pagination flatten only the joining edge |
| 1 | A locally dark-themed grid inherits a light panel alias | Frame reads the current semantic card/border/muted tokens directly |
| 1 | Table row-model evaluation can queue an update before mounting | Controlled pagination owns filter/sort resets and page clamping; render-time automatic resets are disabled |
| 2 | Counts and headers compete with content | Smaller consistent grid heading; neutral flexible-width count; selected counts retain semantic emphasis |
| 2 | Every work item resembles a stacked card with a strong green command | Flat outline rows, one content area, a quiet explicit action with directional icon |
| 2 | Confirmation names wrap around inline codes; quantities resemble filled workflow arrows | Stack code below name; low-emphasis clickable quantities; ordinary future dates are neutral |
| 2 | User administration mixes Chinese and English controls; reset-password buttons dominate | Localized copy, content-sized quiet row actions, one persistent creation command; remove redundant summary card shell |
| 2 | Intranet table divides all columns equally and uses an unrelated avatar palette | Shared grid with flexible title column and bounded metadata/actions; system avatar fallback |

## Review routes

- EMP browser-login preview backed by the existing development API: `http://localhost:3001/zh-CN/engagement`, `/zh-CN/admin/users`, `/zh-CN/confirmations`.
- Intranet: `http://localhost:3007/zh-CN`.
- Shared component specimen: `http://localhost:3008/specimens/DataWorkbench`, linked from `/blocks`.

Shared changes live in `packages/ui`. Domain pages retain their existing permissions, API callbacks, preview/download destinations and business data. No remote business records are intentionally edited during visual review. No merge or deployment is part of this optimization pass.

## First-pass verification (before the second-pass additions)

Browser review used the authenticated development backend through the repository's localhost API proxy. Inspected live EMP project list, user management, confirmation center, Intranet and CMP; also inspected the TMS timesheet. Applied changes were reviewed in local EMP project list, user management, confirmations, the EMP work-item dock and Intranet. Screenshots were captured in the task conversation. No business data was changed through row action buttons.

The component specimen was checked at an evaluated 1441px and 768px layout width and in a 382px nested container. Verified long text, light/dark surfaces, search/no-results and clearing search, first/last navigation across 1,000 pages, compact previous/next navigation, and primary action visibility with secondary actions inside overflow. Used Enter to open overflow and run a specimen action, Escape to close it, and inspected the returned trigger focus ring. Intranet search for `Illustrative` produced the matching notice. A prior render-time table warning stopped recurring after reload with controlled pagination.

| Command | Result |
| --- | --- |
| `corepack pnpm --filter @project-wing/ui test` | 17 files, 74 tests passed |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/views/admin-users.test.tsx src/views/confirmations.test.tsx` | 2 files, 16 tests passed |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmation-template-library.test.tsx` | 34 tests passed |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx src/components/project-confirmation-template-library.test.tsx -t 'rows per page\|project-wide confirmation register'` | 2 relevant register tests passed; nonmatching tests skipped |
| `corepack pnpm --filter @project-wing/intranet exec vitest run src/app/page-client.test.tsx` | 16 tests passed after adding the missing Happy DOM Web Animations stub |
| `corepack pnpm --filter @project-wing/ui lint` | Passed |
| `corepack pnpm --filter @project-wing/emp lint` | Passed |
| `corepack pnpm --filter @project-wing/intranet lint` | Passed |
| `corepack pnpm --filter @project-wing/ui-showroom lint` | Passed |
| `corepack pnpm --filter @project-wing/emp build` | Passed |
| `corepack pnpm --filter @project-wing/intranet build` | Passed |
| `corepack pnpm --filter @project-wing/ui-showroom build` | Passed on Node 24.19; existing PDF font-route tracing warning remains |
| `node scripts/design-first/cli.mjs validate-registry` | Passed |
| `node scripts/design-first/cli.mjs audit --json` | 103 pre-existing unexpected findings outside touched/new files; zero findings in touched/new files; baseline not expanded |

The initial Node 22.14 build attempt could not load the TypeScript formatter config; rerunning with the bundled Node 24.19 succeeded. Root-wide tests, production rollout and all-page mobile acceptance were not run. Remaining baseline design-system capabilities retain their previous registry status. CMP and TMS domain-specific tables were inspected, not rewritten; their shared work-item presentation benefits from the common change.
