# Narrow viewport review — 2026-09-05

Status: implemented corrections validated locally; conditional permission/token flows and sub-480px browser acceptance remain explicitly unverified. This extends the sustained enterprise UI review. No PR, merge or deployment was performed.

## Implemented corrections

- EMP project workbench: below 1024px, a named pane selector gives directory, files, preview, review notes or project tasks the content region. Existing resizable groups and file editors are retained. Hidden panes are inert. Returning to a wide viewport restores the preceding layout and stored pixel widths. Review notes remain mounted after first opening, so switching regions does not discard their local state.
- Shared task dock: compact screens use a native modal, no reserved width, bounded viewport spacing, no resize handle and Escape cancellation. Wide screens retain the dock.
- Shared action-bar and EMP file-identity measurement elements: invisible measurement content is clipped in a fixed viewport wrapper instead of extending document scroll width.
- TMS timesheet: filters no longer overlap the title/actions below the wide breakpoint. Below 768px, boards stack with useful heights and one keyboard-accessible horizontal scroller moves identity columns and dates together. Desktop frozen columns and resize preferences are unchanged. Approval grids retain only employee identity as sticky on narrow screens.
- EMP confirmation template and response libraries: below 1024px, list and preview stack vertically with minimum usable proportions. Fullscreen preview remains available.
- EMP project/personal settings: fixed three-column fields and negative offsets replaced with stacked narrow fields and two-column wide fields. File-reference import fields also stack.
- Shared dialog viewport bounds cover narrow and short landscape screens. Document viewer toolbar groups can wrap inside narrow preview panes without overlapping.
- New-project initialization options stack below 640px, with matching keyboard orientation, rather than truncating the choices.
- Shared member directories contain wide rows in a named keyboard-accessible scroller. Member search/clear controls no longer sit outside their allocated space on narrow screens.
- Shared top bars retain the brand mark on narrow screens and place priority search on a second row; the old three-track rule was clipping return/quick actions. Accessible brand names remain present.
- CMP legacy modal workspaces now sit above the shared header (60 > 50), with bounded dialog width and narrow padding. The regression test compares the actual two layer values rather than preserving the obsolete literal 11.
- SmartForm designer narrative columns keep a 240px minimum instead of wrapping long audit procedures into near-vertical text. Table editors release frozen columns on narrow screens; the existing scroll containers and row/card modes remain intact.

## Interactive evidence

Environment: local worktree frontends connected to the existing development API through localhost proxies, authenticated as System Admin. No project creation, invitation, approval, upload, archive or save was submitted. Browser captures are inline in the task.

The browser environment currently clamps the tested minimum to **480 CSS px**; do not claim a 390px interactive acceptance. Wide restoration is exercised at 1280px.

| Page family | Evidence / status |
| --- | --- |
| EMP project home | 480px folder selector and 456px content; no residual hidden sidebar; 1280 → 480 → 1280 restores 184px user sidebar width. |
| EMP project workspace | Directory selection returns to files; notes and project tasks occupy ~456px. Wide restoration returns directory to 208px and files to ~1024px. No document-level horizontal overflow. |
| EMP new project | Source and settings flow exercised without submission. All three initialization options now occupy separate ~373px-wide rows with full labels. Invitation dialog opened, no invitation or project submitted. |
| EMP confirmations | 480px navigation and list verified. Template preview opens two ~370px-high full-width regions. Actual 10-page PDF loaded. Fullscreen reaches viewport bounds. Final toolbar check: ~437px-wide, ~85px-high toolbar; navigation occupies the first row and zoom/actions the second (~391px), with no overlap or page overflow. |
| CMP client list/detail | List uses internal table scrolling; client details stack to one column. No document overflow at 480px. |
| CMP new client | Authenticated account receives an explicit permission-denied state; form interactions not verified. No permission workaround attempted. |
| Shared task overlay | CMP task dialog is modal, ~456px wide with 12px margins, document width remains 480px; Escape closes it. Explicit post-unmount opener focus restoration has a passing automated regression test. |
| TMS timesheet | Before: 448px frozen columns left date region at 0px. After: date table ~978px, scrollable body ~1426px, page width 480px. Keyboard ArrowRight reached scrollLeft ~828px and exposed later dates/description. Stacked boards are ~192px high. No entries edited. |
| EMP inbox route | Confirmed route is a redirect to project home, not the unused legacy inbox view. |
| EMP members/admin | Member table previously expanded page width to 812px; now page is 480px with ~432px table viewport and 788px internal table. User list and create-user dialog opened without submission. All eight top-bar actions and the return control are within the viewport. |
| EMP project settings | Final 480px check: dialog ~464px wide with 8px viewport margin; name/code fields ~428px wide and fully contained. Escaping settings and returning to 1280px restores the 208px directory / ~1024px files split. |
| SmartForm designer | Development authored fixture: toolbar, table selection/edit dialog and cancel exercised. Narrative first-column width ~240px; editor frozen cell computed position is static on narrow screen. No definition saved. |
| Intranet | Knowledge list, compact system navigation and notification preview inspected at 480px, no page overflow. |
| TMS overview | Employee summary and read-only expanded daily details checked at 480px, table scroll stays internal. Approvals URL resolves to the ordinary timesheet for the current role; no approval flow claimed. |
| CMP additional families | Business list, approval list/detail, billing, dashboard and subject-map page checked. No document overflow at 480px. Approval modal title/close now above header; at 800×480 the dialog is ~432px high and its close button is visible. |
| Conditional routes | New/edit CMP client flows restricted by current role; invitation-token acceptance and signing flows not exercised; no credentials, roles or permissions changed to bypass them. Legacy route aliases are covered by their target page implementation. |

## Current validation

- EMP `vitest run src/lib/workbench-compact-layout.test.ts src/views/workspace.test.tsx --maxWorkers=1`: 73 passed.
- TMS `vitest run src/components/timesheet-workspace.test.tsx --maxWorkers=1`: 62 passed.
- Shared UI `vitest run`: 145 passed at the first narrow-layout checkpoint, before adding the compact-viewport hook test and final CSS bounds.
- Shared UI compact hook + task overlay tests: 2 passed.
- EMP confirmation response/library + project confirmation + settings tests: 159 passed, 2 failed because a legacy settings fixture omitted the newly required translated code-label map. Fixture repaired without changing behavior assertions.
- EMP settings + projects + new-project rerun: 108 passed.
- EMP `vitest run src/components/project-file-type-icon.test.tsx src/views/new-project.test.tsx --maxWorkers=1`: 13 passed.
- EMP `vitest run src/components/smart-form-v2-puck-editor.test.tsx src/components/smart-form-v2-template-designer.test.tsx --maxWorkers=1`: 36 passed.
- EMP `vitest run src/components/project-page-header.test.tsx src/views/workspace.test.tsx src/views/members.test.tsx --maxWorkers=1`: 92 passed.
- EMP `vitest run src/components/workbench-compact-controller.test.tsx src/lib/workbench-compact-layout.test.ts --maxWorkers=1`: 8 passed, including compact→wide restoration and preserving subsequent manual desktop changes.
- Shared UI `vitest run`: 148 passed / 25 files at final shared-component checkpoint. Task overlay focus regression subsequently rerun: 1 passed.
- CMP `vitest run src/components/cmp-app-shell.test.tsx src/components/cmp-acceptance-view.test.tsx --maxWorkers=1`: 68 passed, including the corrected modal/header layer contract.
- `pnpm --filter @project-wing/ui --filter @project-wing/emp --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ui-showroom lint`: all 6 passed.
- `pnpm --filter @project-wing/emp --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ui-showroom --workspace-concurrency=2 -r build`: all 5 passed. EMP/CMP builds rerun after the final controller/modal correction: both passed. Showroom retains an existing dynamic PDF-font tracing warning.
- `node scripts/design-first/cli.mjs validate-registry`: passed; `node scripts/design-first/cli.mjs`: 103 existing unexpected boundary findings. A newly introduced inline TMS style was removed instead of adding a baseline allowance.
- `git diff --check`: passed. Generated next-env and registry newline-only changes restored; no business changes reverted.

The repository-wide full test command, live business mutations, remote CI, deployment, PR and merge were not run. Test counts above are individual runs, not a deduplicated aggregate.

Temporary browser viewport overrides were reset. The existing project, admin, Intranet, showroom and confirmation-preview inspection tabs were retained; implementation remains in the isolated `codex/saas-ui-consistency-pass` worktree.

Pre-existing CMP/TMS workflow assertion failures and UI-boundary audit findings from the preceding color review remain separately documented; no assertions or boundary allowances were weakened to hide them.
