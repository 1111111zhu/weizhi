# Mobile walkthrough log

## Working loop

For each iteration, first choose a real user goal rather than a list of buttons. Complete the task continuously, including returning to the source context and checking the persisted/resulting state. Record friction even when the operation technically succeeds. Fix the scoped issue, then repeat the same path and a related recovery/return path before calling it verified.

Inspect navigation context, touch targets, excessive steps, long filenames, multiple questions/replies, scroll and draft retention, mode transitions, visible completion/error feedback, accidental actions and recovery. Keep the [full operation-parity checklist](mobile-operation-parity.md): a simpler mobile layout must not silently remove a business operation.

Walkthroughs are sequential checkpoints: finish edits and compilation, load the intended start state, then walk the path without interleaving hot-reload edits. A hot-refresh interruption or a test starting on the wrong route is a failed test attempt, not proof that the flow passed. Once a flow depends on real authorization, persistence or files, use a backend-attached login environment; fixture walkthroughs cannot replace that acceptance.

## 2026-09-10 — first comfort-focused pass

Environment: local showroom `http://127.0.0.1:3047/specimens/MobileWorkspace`, independent Playwright CLI session `mobile-walkthrough`, Chromium viewport 390×844. Synthetic data only; no production file or API mutations. User accepted the general direction and requested continued self-walkthrough and friction discovery; this is not a global design-registry Ready claim.

| ID | Goal and observed friction | Change | Verification |
| --- | --- | --- | --- |
| WT-01 | Reply repeatedly to Q1. After five longer replies, the latest message bottom was at 1115.71px while the content viewport ended at 753.51px; content scroll remained at zero. A user could reasonably think the send did nothing. | Reveal a newly sent local reply after DOM commit. Do not auto-scroll simply because a saved thread is opened or another question changes. | Sent another message and confirmed it was inside the visible content area. Scrolled back to an earlier message, switched to reading and returned: the prior 40px position was retained (40.09px reported after browser rounding). Pure regression tests cover pending/local/current-question versus historical/other-question cases. |
| WT-02 | Open `总体审计策略` under planning. Its table still showed bank-balance reconciliation and bank-confirmation work, making the document context misleading. | Give planning, cash and receivable fixtures their own summary, procedures, question content and reference file. Procedure result choices include the current value and context-appropriate options. | Planning now shows materiality, risk and resource procedures. Its Q1 opens `风险评估汇总表`; Back returns to the planning question. All fixture references/question counts and planning/receivable procedure IDs have regression coverage. These are synthetic profiles, not production document-inference rules. |
| WT-03 | After a move, confirmation alone left the user to reopen the location picker and find the target folder. | Add a destination-specific follow-up action after successful movement. Clear stale feedback/destination when a new selection starts. | Moved `银行回函.pdf` from cash to receivables, clicked `前往应收账款`, and verified the moved file in the destination. |

Evidence under `docs/evidence/mobile-app-experience/`:

- `walkthrough-reply-before.png`
- `walkthrough-reply-after.png`
- `walkthrough-planning-after.png`
- `walkthrough-move-followup.png`

Commands/results for this pass:

```powershell
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-workspace-model.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-model.test.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx
git diff --check
```

The model suite passed **22 tests**; showroom TypeScript, scoped format/lint and whitespace checks passed. Scoped design-first boundary audit of the specimen was clean. Browser paths above were exercised and screenshots inspected. One move-path attempt ran after hot refresh had changed the starting route; it timed out and was rerun from a verified cash-folder start.

## 2026-09-10 — settings and confirmation draft pass

User requested removal of the `EMP · 手机工作台样例` label and progressive addition of missing functions. Removed developer/prototype explanations from the application canvas and page title. Required validation, storage failures and action confirmations remain visible. Scope/limitations stay in this log and delivery report, not as permanent in-app instructions.

Implemented local preview paths:

- Header gear / My → Settings → appearance and read-only account profile. Theme, list density and text size apply immediately and survive reload in the current browser session.
- Bottom navigation / My → Confirmation Center → search, project/status filters → exact record details.
- New / edit draft → required-field, email and calendar-date validation → save → exact detail → original filtered list. Leaving an unfinished form preserves it; saving replaces the form history entry. Non-draft records cannot be edited through this entry, including direct edit links.
- Confirmation type/status labels use the shared domain TypeScript unions. This is **not** the production create/dispatch API contract and does not send email or change actual confirmation data.

Independent browser: Playwright CLI session `mobile-services`, local showroom at port 3047, Chromium 390×844, 320×740 and 1280×900. No production/API writes.

| Finding | Fix and repeated verification |
| --- | --- |
| Settings and submit controls stayed content-width despite layout utilities. | Used the shared Button `fullWidth` contract. Checked full-width settings and Save at 320px with large text. |
| Invalid save left focus at the submit button. | Focus and reveal the first invalid field after rendering errors; verified active element is the Project combobox. |
| Saved forms would remain in the browser trail. | Replace the form entry on save; walked create → refresh → edit → save → Back and verified the filtered list, not an empty form. |
| Long project names clipped in the 320px dropdown. | Optional wrapping in shared ViewSwitcher; verified full long option display, no horizontal overflow, Escape and keyboard selection. Default desktop behavior is unchanged. |

Also walked draft interruption/resume (including multiline notes), status-filter/detail return, read-only sent-record detail and direct edit rejection, preference reload, and narrow/wide overflow checks. Inspected screenshots: `mobile-settings-dark.png`, `mobile-confirmation-validation.png`, `mobile-confirmation-detail.png`, `mobile-confirmation-list.png`, `mobile-confirmations-320-dark.png`, `mobile-confirmation-select-320.png`, `mobile-confirmations-wide.png` under `docs/evidence/mobile-app-experience/`.

Two unsuccessful test attempts were rerun: hot refresh restored an earlier settings route; a direct-link test incorrectly expected Back to ignore its actual preceding settings page. Neither attempt is counted as a passed workflow. The successful interrupted-draft test started from the actual confirmation list, then used New and Back continuously.

Validation commands:

```powershell
corepack pnpm install --filter @project-wing/ui-showroom... --filter @project-wing/emp... --offline --frozen-lockfile --ignore-scripts
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx
corepack pnpm --filter @project-wing/emp exec vitest run src/lib/mobile-operation-parity.test.ts
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm --filter @project-wing/ui lint
corepack pnpm exec ultracite check 'apps/ui-showroom/components/showroom/specimens/mobile-*.tsx' 'apps/ui-showroom/components/showroom/specimens/mobile-*.ts' 'packages/ui/src/mobile-workspace*' packages/ui/src/view-switcher.tsx docs/design-system.registry.json apps/ui-showroom/package.json
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json
git diff --check
```

Results: install passed; model suites **29 passed**, shared mobile UI **8 passed**, operation-map **2 passed**; both TypeScript checks, scoped formatting/lint and registry structure passed. Scoped boundary audit via `runAudit({stagedFiles:[...four mobile canvas components...]})` passed. No application errors appeared in the checked browser console.

The full design-first boundary invocation reported **114** unexpected repository findings. The strict Ready + Approved registry check reported **795** unmet requirements, including experimental mobile evidence and missing global approval. Those gates did not pass; no baseline was widened and no component was marked Ready. The design-first skill kept additions in the shared component boundary and recorded them as experimental.

Not run: production build, full repository suite, real backend/login confirmation workflow, real dispatch/receipt processing, physical mobile devices. No push, PR, merge or deployment was performed. Next parity work includes confirmation templates/receipt handling and remaining settings/account/integration operations; the complete mobile product is still unfinished.

## 2026-09-10 — first EMP adoption: settings

User approved one browser application, shared business/permission logic and adaptive desktop/mobile presentations. No APK wrapper. User also requested less green: ordinary file icons, hover/selected-row surfaces and confirmation status text now use neutral tokens; selected navigation and primary actions retain emphasis.

Production-source change: `GlobalSettingsPanel` and `WorkbenchSettingsPanel` opt into the shared `SettingsDialogShell` category/detail navigation. Existing service panels, permission-derived categories and callbacks are unchanged. The optional API preserves the desktop sidebar and legacy selector for other consumers. Content remains mounted when returning to the category index and resizing, so the shell does not discard input. Contextual initial sections and a repeated archive-review request reopen the intended detail.

Findings and fixes:

- Rendering two responsive navigation copies produced ambiguous controls in 8 existing EMP tests. Render the appropriate navigation using a hydration-safe media subscription; keep the content node stable. Repeated the unchanged EMP suites: **39 passed**.
- Shared button styling overrode utility sizing/alignment. Added opt-in shared settings CSS for left-aligned full-row actions and 48 CSS px minimum touch targets, with desktop rules untouched.
- An initial geometric assertion reported a 47.9968px Back-button width despite computed minimum width of 48px (browser rounding). Inspected both values and verified the 48px CSS contract; this is not a smaller touch-target acceptance rule.
- A standalone settings subpage needs to return to its category (mail → integrations; cache → Desktop Agent). Added routing tests; ordinary fixture users cannot enter administrator pages via URL.

Interactive environment: local showroom port 3047, independent Playwright CLI session `mobile-settings-shell`, widths 390, 320 and 1280. Paths: Settings specimen → personalization → edit unsaved name → Back → reopen → resize wide/narrow; category keyboard Enter activation and focus restoration; dark narrow index. MobileWorkspace → settings → integration → mail → return; recycle search/clear; direct administrator-route rejection. Screenshots inspected and retained under `docs/evidence/mobile-app-experience/`: `settings-mobile-index.png`, `settings-mobile-detail.png`, `settings-mobile-dark-320.png`, `settings-desktop-preserved.png`, `mobile-settings-complete-index.png`.

Commands/results:

```powershell
corepack pnpm --filter @project-wing/ui exec vitest run src/settings-mobile-navigation.test.tsx src/settings-dialog-shell.test.tsx src/mobile-workspace.test.tsx
corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-wing-top-bar-controls.test.tsx src/views/workbench-settings-panel.test.tsx
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui lint
corepack pnpm --filter @project-wing/emp lint
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check packages/ui/src/settings-dialog-shell.tsx packages/ui/src/settings-dialog-shell.css packages/ui/src/settings-mobile-navigation.test.tsx 'apps/ui-showroom/components/showroom/specimens/mobile-*.tsx' 'apps/ui-showroom/components/showroom/specimens/mobile-*.ts' apps/emp/src/components/project-wing-top-bar-controls.tsx apps/emp/src/views/workbench-settings-panel.tsx apps/ui-showroom/components/showroom/specimens/settings-specimen.tsx
```

Shared UI suites: **15 passed**; EMP suites: **39 passed**; mobile models: **32 passed**. All three TypeScript checks and scoped formatting/lint passed. Scoped design-first audit found two existing `h` suffix literals in `workbench-settings-panel.tsx` (one fingerprint); this change adds only four shell props in that file. Those pre-existing findings were not concealed or baselined. No whole-system Ready/Approved claim.

The attempted isolated PostgreSQL/API/EMP startup command was rejected by the execution policy before running. It was not retried through a different execution mechanism. Therefore real authenticated settings persistence, backend errors, native Agent actions and authorization changes were **not** interactively validated in this pass. Source adoption is implemented, but product acceptance is not complete. No full repository tests, production build, deployment, PR or merge in this pass. Chrome first-run/physical-device acceptance also remains outstanding.

## 2026-09-10 — My page destination correction

User explicitly confirmed that `EMP待办` means the top-bar personal work-item feed (system declarations/project invitations), not the bottom navigation's review-note tasks. Removed the duplicate Confirmation Center link from My and added an independent `#emp-work-items` destination. Bottom Tasks (`#tasks`) and Confirmations (`#confirmations`) are unchanged. The work-item page returns to My. The isolated showroom has no real EMP work-item feed; it displays an unavailable state rather than mislabeling review questions or falsely reporting zero pending work. Actual feed integration remains open and was disclosed to the user.

Verified in the existing real Android Chrome session `android-mobile`: My has no duplicate Confirmation Center row; bottom Confirmations remains; EMP work-item entry opens the distinct page; Back returns to My. Screenshot: `docs/evidence/mobile-app-experience/android-account-emp-work-items.png`. One attempt timed out after hot refresh restored the settings route; the successful repeated path started from an explicit My URL after edits had finished.

Validation: `corepack pnpm --filter @project-wing/ui-showroom test:mobile` — 33 passed; `corepack pnpm --filter @project-wing/ui-showroom typecheck` — passed. `corepack pnpm exec ultracite check` on `mobile-settings.tsx`, `mobile-workspace-model.ts`, `mobile-workspace-specimen.tsx`, and `mobile-settings-model.test.ts` — passed. No real work-item API, production deployment, PR or merge was performed.

## 2026-09-10 — account grade

Added a read-only `职级` row below email. The isolated Alex Chen fixture uses global account grade `MANAGER`; its displayed `Manager` label comes from shared `GLOBAL_ROLE_METADATA`, not project-role/signoff labels. The same fixture now supplies name/email to My and Account Details. Missing grades render `—`; no real user's account or permissions were changed.

Validation: `corepack pnpm --filter @project-wing/ui-showroom test:mobile` — 34 passed; `corepack pnpm --filter @project-wing/ui-showroom typecheck` — passed; `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-account-model.ts apps/ui-showroom/components/showroom/specimens/mobile-settings.tsx apps/ui-showroom/components/showroom/specimens/mobile-settings-model.test.ts` — passed. Actual Android Chrome session `android-mobile`, Account Details: verified the grade definition and absence of editable inputs; captured and inspected `docs/evidence/mobile-app-experience/android-account-grade.png`. An initial test incorrectly used an accessible name for a definition-list term; the corrected check uses the observed `dt`/`dd` text. No backend mutation, full-suite run, production build, PR or deployment.

## 2026-09-10 — project search-row creation entry

Replaced the control to the right of project search with a neutral plus link named `新建项目`. The existing filter sheet is retained via the project-header control; Settings remains reachable from My. Creation-link visibility uses the existing shared `canGlobalRoleCreateProject` rule with the showroom identity, without defining new permissions.

The plus opens `/specimens/MobileProjectCreation`, a standalone mobile composition of the existing GuidedForm project-creation preview, without the component-catalog chrome. No second business creation implementation or real API mutation was introduced. Creation persistence, full form parity and draft retention inside the creation flow are not claimed; final confirmation reports unavailable creation rather than claiming a project/invitation was saved.

Actual Android Chrome session `android-mobile`: verified the plus position/entry, header filter sheet, source page, return link and preserved project search/filter state. An initial search assertion ran before client hydration; inspected stored and visible values (both Orchid), then repeated with a hydration-aware wait and passed. Screenshots: `android-project-create-plus.png`, `android-create-project-entry.png` in `docs/evidence/mobile-app-experience/`.

Commands: `corepack pnpm --filter @project-wing/ui-showroom typecheck` passed; `corepack pnpm --filter @project-wing/ui-showroom test:mobile` passed 34 tests; `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx apps/ui-showroom/components/showroom/specimens/mobile-project-creation.tsx apps/ui-showroom/components/showroom/specimens/guided-form-specimen.tsx 'apps/ui-showroom/app/**/MobileProjectCreation/page.tsx'` passed. No backend creation, production build, PR, merge or deployment.

## 2026-09-10 — mobile creation stages and flatter compact density

User approved two stacked creation entries, business search only after choosing the existing-business path, and direct progression for quick creation. Reused MobileListItem/Input/GuidedForm while retaining one composition's form state. URL fragments represent source/business/setup/review; explicit Back and browser Back follow the selected path. A fresh forward action truncates abandoned forward steps. Verified business query, selected business, project name and accounting-standard preservation through back/re-entry, and that quick creation returns to source rather than business search. Desktop still uses its original intro tiles and form layout; the desktop quick default remains Dummy. No real project creation is connected or claimed.

The user then requested less whitespace, fewer cards, an input height closer to the Chrome address field and equal-height My rows. Compact mobile surfaces now use 40px single-line fields, 44px action targets and 16px text-entry fonts. Header/field/group spacing is reduced. Removed outer cards from mobile project/file/confirmation/settings/account lists and from compact grouped forms; retained field borders and separators. My uses one equal-row grid, with each link stretched to fill its row. Native browser chrome cannot be controlled by application CSS; 40px is the application's consistent visual target, not an assertion about every browser/device's address bar.

Android measurements before → intermediate compact pass on identical form content: header **72.76 → 52.76px**, first field **126 → 89px**, input **48 → 44px**, content scroll height **2189 → 1613px** (~26% less). The user's final equal-height refinement further sets the input to **40px**, which was separately asserted on project search. Do not present the intermediate 1613px total as a measured final 40px total. My's three row heights were asserted equal within 0.1px. Browser screenshot/device scaling can introduce subpixel differences; targets were checked in CSS pixels.

Interactive evidence: actual Android Chrome, session `android-mobile`, local showroom; desktop Chromium session `mobile-settings-shell`, 1280×900. Checked stacked source/no early search, existing-business path and retained input, quick path and browser Back, blank/template switching and template-popup opening, flat project/My/profile views, equal My rows, 40px search, and dark My view (restored the prior preference afterward). A stale reference and a later template-selection attempt failed after the shared test tab changed state; neither is counted as a successful selection. The menu-opening and subsequent navigation/layout checks passed. Production/backend creation, full template authoring, reload persistence of the creation draft, and physical-device keyboard acceptance were not tested.

Screenshots under `docs/evidence/mobile-app-experience/`: `android-create-source-flat-compact.png`, `android-create-business-search.png`, `android-creation-density-before.png`, `android-creation-density-after.png` (intermediate 44px input pass), `android-projects-search-40.png`, `android-account-equal-rows.png`, `android-account-equal-rows-dark.png`, `android-profile-flat-compact.png`, `desktop-creation-layout-retained.png`.

Commands/results:

```powershell
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx src/guided-form.test.tsx src/settings-mobile-navigation.test.tsx src/settings-dialog-shell.test.tsx
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check packages/ui/src/mobile-workspace.css packages/ui/src/settings-dialog-shell.css 'apps/ui-showroom/components/showroom/specimens/mobile-*.tsx' apps/ui-showroom/components/showroom/specimens/guided-form-specimen.tsx
```

37 model tests and 24 shared UI tests passed. Showroom typecheck and scoped lint/format passed; scoped design-first canvas audit passed. The design-first skill kept density rules in shared mobile styles instead of changing desktop/global tokens. No global Ready/Approved claim, production build, full-root suite, backend mutation, PR, merge or deployment.

## 2026-09-10 — search-first project header

At the user's explicit request, removed the standalone Project heading and project filter button/sheet. Search and the creation plus now occupy the fixed header. The body shows Recent Projects, or Search Results when a query exists. Bottom Projects navigation is unchanged. Retired the `onlyOpen` preference from the preview state schema; migration coverage verifies that old filter data is ignored without losing search or note drafts. This is a deliberate user-authorized removal of the preview's project filter, not a change to desktop filters.

Validation: `corepack pnpm --filter @project-wing/ui-showroom test:mobile` — 38 passed; `corepack pnpm --filter @project-wing/ui-showroom typecheck` — passed; `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx apps/ui-showroom/components/showroom/specimens/mobile-workspace-model.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-model.test.ts` — passed. Actual Android Chrome session `android-mobile`: confirmed no standalone title/filter, search inside header, matching and empty search, Clear Search restoring recents, creation entry and return. Inspected `docs/evidence/mobile-app-experience/android-projects-search-header.png`.

A transient development hydration diagnostic reported a `caret-color: transparent` style mismatch after screenshot/navigation; no application suppression was added. A later screenshot attempt started on another page after shared-tab navigation and timed out. The final capture used an explicit Projects URL and preserved the caret; the post-reload console had no errors. No real backend work, full repository suite, build, PR, merge or deployment in this pass.

## 2026-09-10 — neutral mobile appearance

At the user's request, the design-first workflow introduced an opt-in shared mobile palette, not a replacement of desktop enterprise colors. White/gray and charcoal surfaces replace warm green-tinted controls; primary actions are monochrome. Active bottom navigation retains a small green accent; business status colors are not removed. Inputs, textareas, search and select triggers use the same neutral surface. Placeholder text stays readable and focus rings remain. Mobile project creation now shares workspace theme/text-size preferences.

Validation commands (from the mobile-app-experience worktree):

```powershell
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-color-palette.test.ts src/color-palette.test.ts src/mobile-workspace.test.tsx
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check packages/ui/src/mobile-color-palette.test.ts packages/ui/src/mobile-color-palette.css packages/ui/src/mobile-workspace.css apps/ui-showroom/components/showroom/specimens/mobile-appearance.ts apps/ui-showroom/components/showroom/specimens/mobile-settings.tsx apps/ui-showroom/components/showroom/specimens/mobile-project-creation.tsx apps/ui-showroom/components/showroom/specimens/mobile-workspace-state.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx
git diff --check
```

89 shared palette/UI tests and 38 mobile model tests passed; typecheck and scoped lint/format passed. Palette tests cover neutral channels, text/control contrast, opt-in selectors and unchanged semantic status definitions.

Interactive environment: actual Pixel 7 API 36 emulator Chrome via Playwright CDP (`android-mobile`), ADB reverse to localhost:3047. Walked `MobileWorkspace#confirmation-edit`, project dropdown selection, `#settings?section=appearance` light/dark switching, and `MobileProjectCreation` inheriting dark mode. Dark portal surface measured `rgb(36,36,36)`; light input `rgb(245,245,245)` and primary action `rgb(32,32,32)`. Desktop Chromium (`mobile-settings-shell`, 1280x900) walked catalog → mobile → browser Back and asserted restoration of desktop primary token and font size; GuidedForm retains its enterprise palette. Final Android preference is light.

An initial popup assertion incorrectly measured the transparent listbox rather than its painted select-content parent; the corrected assertion passed. A search capture initially used placeholder text as the accessible name and timed out; the actual accessible name is "搜索项目". These are test-script corrections, not application suppressions. No backend integration, full-root test suite, production build, physical-device/keyboard acceptance, PR, merge or deployment was performed.

Additional governance checks: `node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .` passed. The programmatic `runAudit` limited to the five touched mobile appearance/settings/creation/state/ workspace sources returned zero findings. Calling the CLI with `--help` actually ran its default repository audit and reported 114 unexpected findings in other EMP/CMP/TMS sources; that repository-wide gate is not passed. No baseline changed.

Additional Android walkthrough found a separate navigation issue: after entering project creation and using browser Back, the URL can return to MobileWorkspace while the creation content remains mounted. This is not counted as a passing Android cross-page Back flow and needs follow-up before production acceptance.

Screenshots in `docs/evidence/mobile-app-experience`: `android-neutral-confirmation-light.png`, `android-neutral-confirmation-dark.png`, `android-neutral-dropdown-light.png`, `android-neutral-dropdown-dark.png`, `android-neutral-creation-dark.png`, `android-neutral-projects-light.png`, `desktop-palette-retained.png`.

## 2026-09-10 — inline Project label

The user revised the search-first header: restored "项目" immediately left of the search input, within the same row as search and creation plus; no extra title bar or filter restored. `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx` and `corepack pnpm --filter @project-wing/ui-showroom typecheck` passed. Playwright CLI session `android-mobile` on the actual Android emulator at localhost:3047, `/specimens/MobileWorkspace#projects`, asserted left-to-right title/input/plus, vertical center alignment and no document horizontal overflow. Captured and inspected `docs/evidence/mobile-app-experience/android-projects-inline-title.png`. No business code changed; unit suite, backend flows, build and deployment were not run for this text/layout-only pass. Playwright was used for rendered QA.

## 2026-09-10 — four-entry confirmation center

The user requested mobile confirmation navigation to mirror the four desktop areas as stacked entry rows. Design-first reuse: existing MobileListItem and MobilePageHeader, no new primitive or palette. `#confirmations` is now the index; `?section=all|templates|information|replies` identifies a child destination. All Confirmations retains its search/filter/create/detail flow and stored filters. Unknown sections fall back to the index; old detail links remain valid.

Only All Confirmations has a fixture-backed workflow here. Template library, information library and reply warehouse have distinct destinations with an unavailable state and return action, not fabricated inventories or zero counts. In particular, a received confirmation record is not a warehouse receipt. These three modules still need real integration and are not marked complete.

Commands: `corepack pnpm --filter @project-wing/ui-showroom test:mobile` — 44 passed; `corepack pnpm --filter @project-wing/ui-showroom typecheck` — passed. `corepack pnpm exec ultracite check` on mobile-confirmations.tsx, mobile-services-model.ts, mobile-workspace-model.ts, mobile-workspace-specimen.tsx and mobile-services-model.test.ts (all in apps/ui-showroom/components/showroom/specimens) — passed after mechanical lint fixes in the touched test file. Registry structure validation passed via `node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .`; scoped runAudit on the four touched implementation files returned zero findings.

Playwright CLI actual Android Chrome (`android-mobile`), localhost:3047 `/specimens/MobileWorkspace#confirmations`: asserted exactly four links, no search on index; entered all four destinations and returned using the header; entered All Confirmations again to confirm search retained; cleared search and used browser Back successfully. Screenshot captured and inspected at `docs/evidence/mobile-app-experience/android-confirmation-center-index.png`. No backend library operations, full root suite, build, PR, merge or deployment.

## 2026-09-10 — compact confirmation filters

Approved two-row toolbar: the top header has Back / All Confirmations / quiet creation plus. Search and a single filter action occupy the second row. Existing MobileActionSheet contains project/status selectors with local pending values, Reset and Apply. Apply commits both selectors together without changing search; closing discards pending edits. Reopening starts with the applied values. The filter action reports the active count and the result summary names the filters. Desktop and backend workflows are unchanged.

Commands: `corepack pnpm --filter @project-wing/ui-showroom test:mobile` — 44 passed; `corepack pnpm --filter @project-wing/ui-showroom typecheck` — passed; `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-confirmations.tsx apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx` — passed. Playwright CLI skill used for actual Android Chrome (`android-mobile`) at localhost:3047 `/specimens/MobileWorkspace#confirmations?section=all`. Walked project + status selection, Apply, active count, reopen, pending Reset then Close (saved selection unchanged), and Reset + Apply. Screenshots captured and inspected: `android-confirmation-toolbar-compact.png`, `android-confirmation-filter-sheet.png`, `android-confirmation-filter-applied.png` in `docs/evidence/mobile-app-experience`. No full repository suite, backend filtering, production build, PR, merge or deploy.

After the equal-width footer refinement, repeated Reset + Apply while searching HSBC: the query remained intact. Verified the relocated plus opens New Confirmation and header Back returns to All Confirmations. An earlier follow-up attempt timed out locating the filter button during a shared-tab/HMR transition; the repeat started from an explicit URL and passed without app suppression.

## Pending production integration

## 2026-09-10 — remove redundant directory toolbar

Removed the Project Directory / Directory Location row and root directory count per user request. Switch Directory remains in More; Select Papers moved there too. Cancel Selection appears only during selection. Selection mode resets on route changes; reentering clears old checked items but completion feedback remains visible after batch actions. No desktop component changed.

Commands: `corepack pnpm --filter @project-wing/ui-showroom typecheck` passed; `corepack pnpm --filter @project-wing/ui-showroom test:mobile` passed (44); `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx` passed. An initial effect-based reset failed lint; replaced with guarded state adjustment, no lint suppression. Playwright skill drove actual Android Chrome at localhost:3047 `/specimens/MobileWorkspace#files?project=orchid`: root → A folder → More → Select Papers → Select All → Mark Viewed, verified completion feedback; reentered and canceled selection; More → Switch Directory → Root. Both removed controls were asserted absent. Captures: `android-directory-root-clean.png` and `android-directory-folder-clean.png` in docs/evidence/mobile-app-experience. Only synthetic preview state was changed. No backend operations, full suite, production build, PR, merge or deploy; batch move itself was not rerun this pass.

## Remaining production work

## 2026-09-10 — single-line project header

User approved a single aligned project/folder title, with project code moved to More → Project Information. Added a read-only sheet containing full project name, code and client. Folder headers no longer repeat project metadata. Document context retains folder/file identity but not project code. Shared mobile headers without a context paragraph now ellipsize on one line; full text remains in the heading's accessible name. Desktop components are unchanged.

Validation commands: `corepack pnpm --filter @project-wing/ui-showroom typecheck` passed; `corepack pnpm --filter @project-wing/ui-showroom test:mobile` — 44 passed; `corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx` — 8 passed; `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx packages/ui/src/mobile-workspace.css` passed. Playwright skill drove Android emulator Chrome session android-mobile at localhost:3047 `/specimens/MobileWorkspace#files?project=orchid`: checked header code absent, opened Project Information and found the same code, entered folder and asserted no context paragraph. At `#files?project=origin`, verified nowrap, ellipsis and no overlap with More. Captures in docs/evidence/mobile-app-experience: android-project-single-line-header.png, android-project-information.png, android-project-long-title.png. Root capture visually inspected. No backend integration, full suite, build, PR, merge or deployment this pass.

## Pending production acceptance

## 2026-09-10 — actual PDF preview integration

The PDF read view now uses the existing @project-wing/document-viewer PDFium renderer instead of an HTML document card. Design-first reuse kept rendering in that package and the mobile toolbar on shared UI components. New opt-in `autoFitWidth` and `renderToolbar` capabilities leave the default desktop toolbar unchanged. The renderer exposes only page/zoom actions to the toolbar, not engine objects. Reading consumes the remaining mobile viewport; pagination is one row and zoom controls open a shared bottom sheet. File/project identities are checked before producing a source; object URLs are revoked and late async results ignored on unmount/source change.

This is PDF-only local acceptance: bank-reply and bank-statement each produce a distinct two-page PDF from synthetic fixture data, visibly labeled as a sample and not audit evidence. It is not a real bank document or a production API connection. Other formats keep their prior preview implementation. Native PDF review-note overlays, Office/SmartForm rendering, real file downloads and durable page/zoom restoration after leaving the read view remain pending. No pinch-zoom or physical-device touch acceptance is claimed.

Commands and final results:

```powershell
corepack pnpm install --offline --ignore-scripts
corepack pnpm install --offline --ignore-scripts --filter @project-wing/document-viewer
corepack pnpm --filter @project-wing/document-viewer test
corepack pnpm --filter @project-wing/document-viewer lint
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-document-preview.tsx apps/ui-showroom/components/showroom/specimens/mobile-preview-pdf.ts apps/ui-showroom/components/showroom/specimens/mobile-preview-pdf.test.ts packages/document-viewer/src/pdf-fit-width.ts packages/document-viewer/src/pdf-fit-width.test.ts
corepack pnpm exec oxfmt --check packages/document-viewer/src/pdf-viewer.tsx packages/document-viewer/src/index.ts packages/ui/src/mobile-workspace.css apps/ui-showroom/styles/specimen.css
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
```

7 viewer tests + 49 mobile tests passed; both typechecks and scoped format/lint passed. Registry structure passed, and scoped runAudit for the three touched mobile preview/workspace implementation files returned zero findings. Ready/Approved was not promoted. Offline installs reported existing peer/deprecation warnings; unrelated transitive re-resolution changes were reverted without discarding the earlier task's lockfile additions.

Initial checks ran before the workspace dependency link existed and failed; they were rerun after installation. The new viewer-local test initially lacked a Vitest dev dependency; added a proper package test script/dependency, then both tests and package typecheck passed. An early autofit effect caused repeated zoom updates; fixed with a document/width guard (capability identity is unstable across zoom events). Fresh console listeners around later PDF loading and page changes captured zero new errors. Old CLI session aggregate error counts still included the pre-fix development errors; those counts are not a fresh failure or a clean session assertion.

Playwright skill: actual Android emulator Chrome, session android-mobile, ADB reverse to localhost:3047, `/specimens/MobileWorkspace#document?project=orchid&file=bank-reply`. Waited for real rendered PDF image resources; captured fit width (~61% at 412 CSS px), page 2, zoom to ~86%, reset to fit, switched to Notes and back. Independently opened bank-statement and paged it; switched dark/light and confirmed paper stays white. PDF skill visual review used the actual renderer screenshots rather than text extraction alone. Captures inspected/copied to docs/evidence/mobile-app-experience: android-pdf-fit-width.png, android-pdf-page-two.png, android-pdf-zoomed.png, android-pdf-statement.png, android-pdf-dark.png. Final preference restored to light. No full root suite, production build, backend acceptance, PR, merge or deployment.

## Remaining rollout work

## 2026-09-10 — filename-only headers, quiet lists and shared file icons

The user requested removal of repeated title/count strips throughout mobile, then clarified that file type icons should match desktop. Removed the document header context, Notes heading/count, Tasks subtitle, Projects heading/count, directory count/order strip, confirmation result-count/filter-summary strip and read-only/type strip. The editor keeps a warning only when unsaved changes exist. Field labels, real empty/error states, per-item information, applied-filter button count, selection controls and PDF page controls remain intact.

Design-first consolidation: ProjectWingFileTypeIcon now owns the existing EMP Fluent 16px artwork contract alongside its preserved default 32px assets and dedicated FileCheck2 SmartForm glyph. EMP ProjectFileTypeIcon delegates to it; mobile uses the same small asset with 24px display sizing. .sf matching is case-insensitive; missing image loads fall back to a generic glyph. No new file classification scheme or navigation icon redesign. Catalog: /mobile#file-icons.

Checks:

```powershell
corepack pnpm --filter @project-wing/ui exec vitest run src/project-wing-file-type-icon.test.tsx
corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-file-type-icon.test.tsx
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check packages/ui/src/project-wing-file-type-icon.tsx packages/ui/src/project-wing-file-type-icon.test.tsx apps/emp/src/components/project-file-type-icon.tsx apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx apps/ui-showroom/components/showroom/specimens/mobile-confirmations.tsx apps/ui-showroom/components/showroom/specimens/mobile-pattern-catalog.tsx
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
```

11 shared icon tests, 1 EMP regression and 49 mobile tests passed. Showroom typecheck and scoped lint/format passed. Scoped runAudit for the EMP adapter and three mobile composition/catalog sources returned zero findings; no baseline or Ready/Approved promotion. Whole EMP typecheck and full repository suite not run.

Playwright QA used a fresh desktop Chromium session mobile-icons-qa at exactly 412 CSS px × 783, localhost:3047, /specimens/MobileWorkspace#files?project=orchid&folder=cash. Verified two PDF and two XLSX 16px Fluent resources loaded successfully, plus SmartForm glyph; opened Notes and asserted redundant heading absent and file header has no context paragraph. Captured/inspected mobile-shared-file-icons.png, mobile-notes-no-summary.png and mobile-file-name-only-header.png under docs/evidence/mobile-app-experience. The earlier browser session was at 25% browser zoom (1648 CSS px despite a 412px window), so its screenshots were replaced, not accepted as narrow evidence.

Actual Android CDP became unresponsive in this pass. Only the stuck automation client/daemon processes were stopped; browser tabs were not closed. Reattachment timed out. This pass is NOT Android-verified; previous emulator results do not prove these latest changes. No backend operations, build, PR, merge or deploy.

## Pending mobile rollout

## 2026-09-10 — canonical SmartForm import for reading

Imported the authored Deferred Income SmartForm V2 and matching response fixture, originally converted from the source audit-programme workbook. This is a valid full SmartForm, not a fabricated three-row display and not a live client record. The assets retain their identity and appear as D-01 / 审计程序——递延收入.sf in a separate Deferred Income folder. No bank document was renamed or overwritten.

Design-first reuse: the generator calls the API's existing SmartFormV2PdfService (standard compiler, Typst layout and PDF annotations), then the mobile read view uses the existing shared PDF renderer. PDF skill visual checks verified both pages. The authored .sf, response JSON and PDF are kept in apps/ui-showroom/public/mobile-smartforms, with a regeneration README. This is a read-only snapshot, not the interactive SmartForm editor. The imported file does not offer Edit and a deep edit URL normalizes to Read; its procedure profile is empty rather than falling back to the unrelated bank demo procedures. Existing sample editors remain available for other files. No project database was touched.

Commands/results:

```powershell
# From apps/api:
corepack pnpm exec tsx scripts/build-mobile-smartform-fixture.ts
# From the worktree root:
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-preview-pdf.test.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-model.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx apps/ui-showroom/components/showroom/specimens/mobile-document-preview.tsx apps/api/scripts/build-mobile-smartform-fixture.ts
```

Asset generation succeeded; 51 tests, typecheck and scoped lint/format passed. The import test compares the complete persisted definition to the canonical fixture, validates the response schema, parses the exported PDF and protects the read-only boundary without weakening original sample edit behavior.

Playwright: desktop Chromium session mobile-icons-qa, 412x783 CSS px, localhost:3047 /specimens/MobileWorkspace#document?project=orchid&file=deferred-income. Verified file title, actual rendered PDF image resources, two-page navigation and absence of the placeholder Edit action. Screenshots mobile-real-smartform-page-one.png and mobile-real-smartform-page-two.png were visually inspected and copied into docs/evidence/mobile-app-experience. Chinese glyphs, table rows and footer page numbers render correctly. At full-page fit the dense table text is small; this does not prove comfortable mobile editing or replace the need for a mobile-native structured reading/editing view. Android reattachment remains unavailable from the previous pass; no emulator or physical-device acceptance claimed here. No real project import, API integration, full repository suite, build, PR, merge or deployment. Opening the result in Codex was queued by the app tool.

## Remaining production integration

## 2026-09-10 — P/R in compact file rows (preview only)

User approved P/R in the existing metadata row, notes above, no chevron. The design-first extension gives MobileListItem separate `action`/`secondaryAction` slots outside its link and optional chevron removal. Two action rows preserve 44px targets; P/R use small semantic green/orange letter accents without filled blocks. A bottom sheet holds signer/time/history, explicit sign action, self-review confirmation and revoke confirmation. Signature counts represent records, not unique people.

Scope was explicitly called out: this is still the isolated specimen. An async question offered preview-only versus live integration; no selection was received before implementation, so work stayed in the safe preview-only scope. No real API request, business signature, audit entry or live project mutation was made. Local `signoffs` is separate from `reviewed`, with a backwards-compatible default. The transition helper uses shared membership permission checks and covers P-before-R, self-review consent, same-reviewer 24-hour cooldown, completed-round rollover and revoke authorization/history. The imported SmartForm checks the canonical response validator. Other sample files explicitly use preview completeness/mutability, not fetched project eligibility. This is NOT the complete backend signature state machine; attachment version identity, server transactions, live eligibility, revoke reasons and authoritative audit/history still require the real adapter.

Commands:

```powershell
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check packages/ui/src/mobile-workspace.tsx packages/ui/src/mobile-workspace.css packages/ui/src/mobile-workspace.test.tsx apps/ui-showroom/components/showroom/specimens/mobile-signoff-model.ts apps/ui-showroom/components/showroom/specimens/mobile-signoff-model.test.ts apps/ui-showroom/components/showroom/specimens/mobile-file-signoffs.tsx apps/ui-showroom/components/showroom/specimens/mobile-workspace-model.ts apps/ui-showroom/components/showroom/specimens/mobile-workspace-specimen.tsx apps/ui-showroom/components/showroom/specimens/mobile-pattern-catalog.tsx
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
```

57 mobile model/source tests and 9 shared mobile tests passed. Typecheck passed. Scoped boundary audit returned zero findings and registry structure passed; no Ready/Approved promotion. Initial lint caught a render-time clock read; clock is now captured on opening the sheet. Submission rechecks time in the transition. Initial geometry check found ~40.7px widths from button CSS precedence; a scoped shared minimum-size rule fixes them to 44px. An initial color assertion inspected the button's wrapper instead of its label; the final explicit P/R label color assertion passed. Formatting and purity issues were corrected without suppressions.

Playwright actual browser: mobile-icons-qa, 412px narrow Chromium, localhost:3047, /specimens/MobileWorkspace#files?project=orchid&folder=cash. Checked R unavailable before P, sign P, cancel then confirm self-review, R cooldown UI, revoke confirmation, retained revoked history and list update. Measured both touch dimensions, confirmed P/R do not open the file, and checked separate label colors. Local bank-reply now contains the QA P and revoked R records only in that test browser's session data. Screenshots inspected/copied: mobile-file-signoff-layout.png and mobile-signoff-sheet.png. No Android/emulator acceptance this pass (previous CDP issue remains), full root suite, production build, backend signoff, PR, merge or deployment.

## Remaining business integration

## 2026-09-10 — reduce file-row height only

Per the user's narrower request, retained separate P/R and note actions instead of adopting a combined signoff entry. Compact secondary-action rows now use two 36px tracks: 72px content height (73px including divider), down from 88px. Text size is unchanged and long labels may grow rather than clip. File-row action targets remain at least 44px wide but are now 36px high; this deliberately trades some vertical touch space for the requested density, without overlapping targets. Comfortable density, dialogs and other list layouts remain unchanged.

Validation: `corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx` — 9 passed; `corepack pnpm exec oxfmt --check packages/ui/src/mobile-workspace.css` — passed. A CSS-only Ultracite invocation passed formatting but returned "No files found to lint"; it is not reported as a lint pass. No typecheck/full suite/build/backend operation or deployment run for this CSS-only adjustment.

Playwright skill, mobile-icons-qa desktop Chromium at 412x783 CSS px, localhost:3047 /specimens/MobileWorkspace#files?project=orchid&folder=cash: asserted row height 72–74px, no title/metadata overlap for all five files, P target at least 44x36px, and successful P-sheet open/close without mutation. Screenshot captured and visually inspected at docs/evidence/mobile-app-experience/mobile-file-rows-compact-72.png. Android/physical-device acceptance not rerun. No PR, merge or production signoff.

## Remaining business acceptance

## 2026-09-10 — signoff sheet refinement and repeat P

Refined the sheet with the existing shared persona avatar, grouped signer/status and timestamp, quieter per-record revoke action, a bounded scrolling history and centered footer actions. P can now be appended repeatedly by the same actor; each record is retained and individually revocable. The earlier duplicate-P guard and "already prepared" disabled state were intentionally removed at the user's request. R's P prerequisite, self-review confirmation and 24-hour same-reviewer cooldown remain unchanged. A signable existing record shows "再次签署 P" rather than an inert gray button. Blocked actions show the reason without a decorative disabled full-width button.

The user first requested a file-type icon beside the filename, then superseded that with removing the filename. Final sheet omits the entire filename/icon row; file-list and preview-header names remain. The temporary rich-description API extension was reverted; shared sheet descriptions retain their existing string contract. Design-first reused shared avatars, buttons and sheets rather than introducing a competing style. This remains preview-only; no real signoff API, backend rule, record or audit log changed.

Validation commands/results:

```powershell
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx
corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-file-signoffs.tsx apps/ui-showroom/components/showroom/specimens/mobile-signoff-model.ts apps/ui-showroom/components/showroom/specimens/mobile-signoff-model.test.ts packages/ui/src/mobile-workspace.tsx
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
```

58 mobile and 9 shared tests, typecheck and scoped format/lint passed. Added repeat-P coverage asserting preserved first record and selected-record-only revocation. Scoped boundary audit on the two signoff implementation files returned zero findings. No Ready/Approved promotion, full suite, build, PR, merge or deploy.

Playwright: mobile-icons-qa, 412px desktop Chromium, local showroom. Planning → P sheet: added two P records, canceled a revoke, confirmed revoke, asserted history length unchanged. Final cash/bank-reply sheet: filename absent, repeat P enabled, footer text geometrically centered. Final screenshot inspected and saved to docs/evidence/mobile-app-experience/mobile-signoff-clean-no-filename.png. Intermediate screenshot with filename is not the final design. Actual Android, real project persistence and production signoff acceptance remain unverified.

## 2026-09-11 — real SmartForm mobile preview and conversation follow-through

The mobile reference now runs the actual EMP `SmartFormV2Preview`, `SmartFormV2Readonly` and `SmartFormV2Editor` against the canonical Deferred Income definition/response fixture at `http://127.0.0.1:3048/zh-CN/dev/smart-form-v2/deferred-income`. This is distinct from the 3047 mobile specimen's production-exported PDF snapshot. Neither page is attached to live project persistence. No production data was saved.

The opt-in preview CSS below 48rem keeps readonly tables as tables, with independent horizontal scrolling, a readable 15rem procedure column, pinned procedure/group labels and compact hierarchy indentation. It removes the outer document card, reduces toolbar/gutters and wraps the title. The editor retains its real existing mobile fields, references, notes and required validation; this pass does not replace its editing model with a new table editor. Wide layouts keep their existing styling. Initial visual inspection caught single-character wrapping from the desktop indentation and `max-width: 0` header contract; these were corrected, not accepted merely because the overflow assertions passed.

Shared Q conversation work is now demonstrated at `/mobile#messages` and registered as Experimental: initial authored question, reply rows, shared rich-text rendering, file links and expandable images. The reader was extracted from EMP's existing renderer. The composer retains native multiline/IME behavior, a circular send control and a measured visual-viewport adaptation. Earlier Android docked-keyboard inspection belongs to the preceding session; **this session has no ADB-connected emulator**, so no fresh Android or physical-device keyboard acceptance is claimed.

Current validation commands (run from this worktree):

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-readonly.test.tsx src/components/smart-form-v2-editor.test.tsx src/components/review-note-rich-text.test.tsx
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-keyboard-viewport.test.tsx src/mobile-message.test.tsx src/mobile-workspace.test.tsx
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-pattern-catalog.tsx apps/emp/src/components/smart-form-v2-preview.tsx apps/emp/src/components/smart-form-v2-readonly.tsx apps/emp/src/components/smart-form-v2-editor.tsx
corepack pnpm exec oxfmt --check apps/emp/src/components/smart-form-v2-mobile-preview.module.css
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
node --input-type=module -e 'import {runAudit} from "./scripts/design-first/cli.mjs"; const result=await runAudit({stagedFiles:["apps/emp/src/components/smart-form-v2-preview.tsx","apps/emp/src/components/smart-form-v2-editor.tsx","apps/emp/src/components/smart-form-v2-readonly.tsx","apps/ui-showroom/components/showroom/specimens/mobile-pattern-catalog.tsx","packages/ui/src/mobile-message.tsx","packages/ui/src/review-note-rich-text.tsx"]}); if(!result.success)process.exitCode=1;'
```

Results: 42 EMP tests and 14 shared UI tests passed; showroom typecheck, scoped lint/format, registry validation and scoped boundary audit passed. The initial catalog typecheck found a `text`/`value` prop mismatch, fixed before the passing rerun. An attempted CLI `--help` invocation actually ran the repository-wide boundary audit and failed with 114 findings outside this focused adaptation; no baseline or assertion was weakened. Full build, full test suite, full clean boundary certification, authenticated project workflow, PR, merge and deploy were not performed.

Interactive evidence: headed Chrome via Playwright CLI session `smartform-mobile`, local mock-mode EMP. At 412×783, switched to readonly, horizontally scrolled the real table by 260px, asserted a procedure width above 230px, stable pinned first column and visible group labels. At 360×780 the page itself did not overflow. Switched to filling, opened a real select and dismissed it with Escape without changing/saving an answer. At 1440×900 the mobile sticky-column rule was inactive. Screenshots were inspected, including the rejected intermediate cramped layout. Accepted images are `emp-mobile-real-table-final.png`, `emp-mobile-real-table-final-scrolled.png`, `emp-mobile-smartform-top.png`, `emp-mobile-real-entry.png` and `emp-smartform-desktop-unchanged.png` under `docs/evidence/mobile-app-experience/`.

The 3047 `/mobile#messages` component catalog was also exercised: image preview opened and closed with Escape, and the message grid was verified at 412px. Visual inspection caught that the catalog's opt-in CSS bundle did not include message styles; the import now belongs to `mobile-workspace.css`, so both the opt-in bundle and full UI stylesheet include it. Evidence: `mobile-message-catalog.png` in the same directory. After this repair, showroom typecheck, catalog Ultracite check and `corepack pnpm exec oxfmt --check packages/ui/src/mobile-workspace.css packages/ui/src/styles.css` were rerun.

Runtime repair: the old non-ignored `.next-mobile-smartform` output was scanned by Tailwind and produced corrupt generated CSS. It is now explicitly ignored; the restarted 3048 service uses `NEXT_DIST_DIR=.next/mobile-smartform-r2` and `NEXT_PUBLIC_API_MODE=mock`. No generated output was hand-edited or deleted.

## 2026-09-11 — semantic SmartForm projection supersedes table-only phone layout

The user's subsequent approval replaces the table-only mobile direction with a generic AST-based reading/filling projection. The follow-up requests remove phone disclosure controls and section-description indentation. Implementation, exact validation commands, screenshots and capability limits are documented in `smart-form-mobile-projection.md`. Desktop comparison/disclosure behavior remains.

## 2026-09-11 — compact chrome and bottom-sheet input follow-up

User reviews further requested fewer frames, modern typography with restrained color, a quieter header/numbering, no anchored phone input popovers, and removal of the N development indicator/solid-black format selection. The current contract and command-level evidence are at the beginning of `smart-form-mobile-projection.md`. Earlier inline-rich-text and table-only screenshots remain historical evidence.

## Remaining live integration

- Real iOS/Android keyboard, IME, safe-area and browser back behavior have not been validated on physical devices.
- Business API failures, authorization loss, upload/download, real PDF rendering and full operation parity remain unconnected in this specimen; they must be walked again after integration.
- A destination shortcut is not undo. Business-safe undo/recovery rules need separate design and validation; no rollback capability is claimed here.
- No PR, merge, deployment or production-ready certification was performed in this pass. Continue fixing observed friction without marking incomplete operations as complete.
