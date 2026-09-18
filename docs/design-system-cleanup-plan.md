# Design-system cleanup plan

Status: active

Started: 2026-08-14

System approval: proposed

Ready capabilities: `Button`, `IconButton`

## Operating rule

Cleanup proceeds capability by capability, not file-count first. A product migration may use only a public capability marked `ready`. Scheduled sweep PRs target a net reduction of 30–50 findings; smaller changes ship only as explicitly labeled correctness or pipeline patches. Each batch must preserve product behavior, reduce at least one measured boundary finding, add no new finding, and pass the affected app's tests plus rendered verification proportional to the visual risk.

Historical findings remain warnings while they are triaged. A rule becomes blocking only after its scoped debt is removed or governed through an approved, owned exception.

## Current batch scorecard

| Metric                          | Latest origin/main | Current | Delta |
| ------------------------------- | -----------------: | ------: | ----: |
| Files scanned                   |                661 |     663 |    +2 |
| Errors                          |                  0 |       0 |     0 |
| Warnings                        |              1,205 |   1,158 |   -47 |
| `arbitrary-value`               |                911 |     864 |   -47 |
| `raw-color`                     |                 25 |      25 |     0 |
| `direct-ui-import`              |                109 |     109 |     0 |
| `relative-design-system-import` |                 52 |      52 |     0 |
| Ready components                |                  2 |       2 |     0 |

The historical repository baseline remains 619 files and 1,707 warnings. This batch removes 47 arbitrary-value findings from EMP workbench directory row states: 42 from production and five implementation-coupled test findings. Active, drag-over, selected, multi-selected, and highlighted-file layers move behind a surface-owned semantic CSS Module without changing their state source or visual values.

## Completed batches

### Batch — EMP workbench directory row states

- Removed 42 arbitrary-value findings from production directory row states and five matching implementation-coupled findings from directory tests.
- Kept `data-active` as the state source while consolidating the 15% active tint, 20% hover tint, 10% dashed drop target at z-index 10, brand tint, selected 2px indicator, and file highlight pseudo-elements.
- Left rename-dialog columns, file-code typography, and icon motion untouched for later classification.
- Replaced Tailwind state-string assertions with semantic module assertions and added a focused stylesheet contract for every migrated layer.
- Passed 78 focused directory/style tests, EMP typecheck, and the exact monotonic DesignFirst comparison against `origin/main`.
- Verified the real compiled CSS Module through a temporary uncommitted Next.js harness at 1000 × 800; every rest, hover, drag, selected, and file-highlight computed style is correct, document overflow is zero, and the browser console has zero errors and zero warnings. The harness was removed before scanning and is not part of the batch.
- Reduced `arbitrary-value` from 911 to 864 with no increase in another DesignFirst rule.

### Batch — EMP confirmation editor remaining semantic styles

- Removed the remaining 37 arbitrary-value findings from the production confirmation editor and two matching implementation-coupled findings from its tests.
- Preserved the compiled managed-select contract: block layout, horizontal box orientation, no line clamp, hidden overflow, and clipped text.
- Preserved seven securities fallback rectangles with their exact prior top, left, width, and 2.2% height values.
- Replaced Tailwind descendant-selector assertions with a semantic class assertion and expanded the editor stylesheet contract to cover every migrated declaration.
- Passed 90 focused confirmation editor/style tests, EMP typecheck, and the exact monotonic DesignFirst comparison against `origin/main`.
- Verified the real compiled CSS Module through a temporary uncommitted Next.js harness at 1440 × 1000 and 1000 × 800 after the local account service was blocked by its missing database environment. Long values clip from 431px to 142px, all seven fallback rectangles resolve correctly, document overflow is zero, and the browser console has zero errors and zero warnings. The harness was removed before scanning and is not part of the batch.
- Reduced `arbitrary-value` from 950 to 911 with no increase in another DesignFirst rule.

### Batch — EMP Smart Form V2 shared table colors

- Removed 22 arbitrary-value findings from the editor and 17 from the read-only renderer.
- Moved the existing header, border, foreground, group, accent, and interactive colors behind one shared semantic CSS Module while preserving the 70% and 55% alpha levels.
- Preserved the existing logical-start and physical-left accent semantics instead of silently changing right-to-left behavior.
- Added a focused source contract that locks the token references and requires both renderers to use the shared module without reintroducing table-color arbitrary values in JSX.
- Passed 31 focused editor/read-only/style tests, EMP typecheck, and the exact monotonic DesignFirst comparison against `origin/main`.
- Verified both modes at 1440 × 1000 and 1000 × 800; computed colors and hover states remain correct and the 848px narrow table stays contained. At 700 × 800, ordinary mobile cards remain uncolored while group cards alone receive the 2px accent and group surface. Document overflow is zero, and the final browser console has zero errors and zero warnings.
- Reduced `arbitrary-value` from 989 to 950 with no increase in another DesignFirst rule.

### Batch — EMP confirmation overview shell geometry

- Removed all 29 arbitrary-value findings from the production overview and all 10 matching implementation-coupled findings from its tests.
- Preserved eighteen navigation widths from 184px through 320px at the existing 8px interval, plus the established motion, 62rem table floor, 24/22/34/10/10 column proportions, 11px progress labels, and loading-row grid.
- Replaced utility-string assertions with semantic `data-navigation-width` state coverage and added a source contract for every governed CSS value.
- Passed 32 focused overview/style tests, EMP typecheck, and the exact DesignFirst audit.
- Verified at 1440 × 1000 and 1000 × 800 that default, collapsed, restored, and pointer-dragged navigation widths remain correct; the narrow 992px table scrolls inside its 730px container without document overflow; and the final console has zero errors and zero warnings.
- Reduced `arbitrary-value` from 1,028 to 989 with no increase in another DesignFirst rule.

### Batch — EMP confirmation editor semantic geometry

- Removed 103 arbitrary-value findings from the production editor and 23 implementation-coupled findings from its tests.
- Deleted the retired PRC Template 1, PRC Template 2, and ShineWing editor renderers. An unexpected retired code now returns to the active template selection state instead of reviving legacy UI.
- Preserved the synchronized managed-template catalog (`STANDARD_FINANCIAL_INSTITUTION`, HK Standard English, and both securities templates), information-library lookup, dynamic field designs, and custom DOCX upload flow.
- Kept API-side historical document rendering compatibility so existing archived artifacts are not invalidated by the product UI retirement.
- Classified the standard PDF and managed DOCX fallback rectangles as domain-specific digital-twin geometry, keeping them surface-owned instead of promoting them to misleading global design tokens.
- Preserved the editor shell, two template popover bounds, nine PDF fields, ten DOCX fallback fields, 8px/10px overlay typography, and the bank-name source cover; added an 18rem template-control floor after browser verification exposed a collapsed selector at 1000px. A source contract locks every governed value and behavior coverage rejects all three retired editor codes.
- Verified at 1440 × 1000 and 1000 × 800 that the catalog exposes Custom upload plus the four current managed templates and no retired option, all nine standard PDF overlays retain their exact geometry, the edited bank value remains visible, the template control remains operable through toolbar scrolling, document overflow stays zero, and the console has zero errors.
- Reduced `arbitrary-value` from 1,154 to 1,028 with no increase in another DesignFirst rule.

### Batch — EMP confirmation overview matrix semantic styles

- Removed all 36 arbitrary-value findings from the production matrix and all 14 matching implementation-coupled findings from its tests.
- Moved four responsive table widths, dense-column width, sticky backgrounds, two shadows, motion properties, four stagger delays, and reduced-motion timing into matrix-owned semantic CSS Module classes without changing a value.
- Replaced utility-string assertions with semantic state contracts for the four width states and sticky header/total tones; added a source contract for every migrated value.
- Passed all 95 matrix and parent-panel tests serially, EMP typecheck and production build, registry validation, exact monotonic baseline validation, and the repository UI-stack guardrail.
- Verified count/percentage switching, sent/received expansion, the 88rem and 64rem width states, sticky first-column behavior under 474px horizontal scroll, and a clean browser console at 1440 × 1000 and 1000 × 800.
- Refreshed the exact UI-stack baseline to lock three findings already removed by intervening `main` work; those three are not included in this batch's DesignFirst delta.
- Reduced `arbitrary-value` from 1,081 to 1,031 with no increase in another DesignFirst rule.

### Batch — EMP CSV canvas palette adapter

- Removed all 31 raw-color findings from the specialized Glide canvas theme in `csv-viewer.tsx`.
- Added 16 semantic canvas-grid tokens with exact light/dark values and a public adapter that resolves them to concrete canvas-compatible color strings.
- Preserved every original light and dark channel, including the eight-digit translucent selection color; no visual palette adjustment is bundled into the migration.
- Added adapter coverage for all 16 Glide color roles and the pre-browser fallback, plus an EMP contract that rejects raw colors and locks all 31 public light/dark definitions.
- Reduced `raw-color` from 56 to 25 with no increase in another DesignFirst rule, while a focused source contract makes this file's reduction monotonic.

### Batch — CMP public color tokens

- Removed all 35 raw-color findings from `apps/cmp/src/app/styles.css` in one sweep.
- Moved 24 exact login, shadow, success, and approval-state definitions behind `@project-wing/ui` tokens; reused Tailwind white only where it is mathematically identical.
- Preserved every original RGB channel, alpha percentage, hex value, shadow geometry, and color-mix percentage.
- Extended the CMP shell contract to reject raw application colors, count all 28 public token references, retain the 36 shadow-alias consumers, and lock all 24 public values.
- Verified exact computed shadow aliases and representative login/approval tokens, real light/dark switching, and zero document overflow on the production login page at 1440px plus 390px.
- Reduced `raw-color` from 91 to 56 with no increase in another DesignFirst rule.

### Batch — EMP public color tokens

- Removed all 43 raw-color findings from `apps/emp/src/styles.css` in one sweep.
- Reused mathematically identical Tailwind black and white values and moved 23 exact brand, Slate, spreadsheet, preview, scrollbar, and smart-form definitions behind `@project-wing/ui` tokens.
- Preserved every original value and color-mix percentage; no visual palette adjustment is bundled into the boundary migration.
- Extended the EMP theme contract to reject raw application colors, count all 25 public token references, and lock all 23 public values.
- Verified exact computed alias/public values and zero document overflow on the production login page at 1440px in latte and mocha plus 390px latte; visual inspection found no layout or theme regression.
- Reduced `raw-color` from 134 to 91 with no increase in another DesignFirst rule.

### Batch — Intranet public color tokens

- Moved 41 Intranet theme, attachment-type, and link colors behind named `@project-wing/ui` CSS custom properties.
- Preserved every original light and dark value exactly; the application stylesheet now contains semantic references only.
- Added a contract test that rejects raw colors in the application stylesheet, counts all 41 public references, and locks the 33 distinct public light/dark token definitions.
- Passed the server-selected theme into the client provider, eliminating the mocha login hydration mismatch exposed by the browser gate.
- Verified public-to-semantic color resolution at 1440px in latte and mocha plus 390px latte, with clean console, request, and overflow assertions.
- Made shared `packages/ui` changes trigger CMP/UI governance validation and added a contract lock for the existing six-consumer deployment mapping: EMP, CMP, Showroom, TMS, Intranet, and IB.
- Reduced `raw-color` from 175 to 134 with no increase in another DesignFirst rule.

### Batch — CMP shadow color tokens

- Consolidated 36 repeated slate and black shadow/overlay colors into three CMP-owned semantic tokens.
- Preserved the original RGB channels and alpha values exactly instead of mapping to Tailwind 4 slate values that differ by one channel.
- Kept the three token definitions visible as raw-color findings for later palette alignment; no exception or baseline masking was added.
- Verified notification overlays and data-grid popovers in a production browser at 1440px, 390px, and night appearance with clean request, console, and overflow assertions.
- Reduced `raw-color` from 208 to 175, a net reduction of 33, with no increase in another DesignFirst rule.

### Batch — CMP native accessible names

- Replaced the notification drawer, notification read-state icon, and boolean indicator wrapper usage with native `aria-label` contracts.
- Deleted the now-unused CMP-local `AccessibleName` component instead of promoting an unapproved private abstraction.
- Added focused accessible-name coverage for both boolean states and retained the existing named-dialog AppShell coverage.
- Reduced `relative-design-system-import` from 40 to 38 with no increase in another DesignFirst rule.

### Batch — CMP grid and Input boundary

- Derived CMP acceptance/client column, filter, and table types from public data-grid component props instead of importing TanStack types in five product modules.
- Reused `projectWingSelectedValuesFilter` instead of maintaining an identical product-local filter implementation.
- Routed the engagement fee and risk Inputs directly through the existing public re-export, preserving their implementation and props exactly.
- Reduced `direct-ui-import` from 114 to 108 and `relative-design-system-import` from 42 to 40 with no increase in another DesignFirst rule.

### Batch — CMP and EMP icon-action boundary

- Migrated CMP fee-row deletion plus EMP archive, email-attachment, file-preview, panel, and zoom actions to the approved public `IconButton`.
- Preserved stable accessible names, existing external Tooltip ownership, disabled behavior, and action callbacks.
- Mapped the EMP-local 28px `icon-sm` size to the public 28px `xs` contract and the existing CMP 36px icon action to public `md`.
- Hardened the public IconButton CSS contract so every named size keeps fixed square dimensions and zero padding, including inside narrow table cells.
- Reduced `relative-design-system-import` from 48 to 42 with no increase in another DesignFirst rule.

### Batch — cross-app Toast boundary and dead UI islands

- Migrated four EMP Toast consumers and four TMS Toast consumers to `projectWingToast`.
- Migrated the TMS root Toaster to `ProjectWingToaster` while preserving `top-center` placement.
- Removed 19 unreferenced CMP, EMP, and TMS component modules after checking static imports, dynamic imports, barrel exports, route conventions, tests, and exported-symbol references.
- Reduced DesignFirst findings from 1,622 to 1,571 and refreshed the exact monotonic debt baseline.

### Patch — compound Button content

- Fixed the shared Button label wrapper so compound children remain an inline flex row.
- Restored CMP data-grid header labels and sort icons to one line without adding page-specific overrides.
- Verified unsorted and sorted headers at 1440 × 1000 and 390 × 844 with no overflow or console errors.

### Patch — stacked notification content

- Kept the shared Button label contract inline while wrapping each notification's title, body, and metadata in one domain-owned grid container.
- Restored the notification drawer's vertical reading order without adding a Button variant, product override of `.pw-button-label`, or new boundary finding.
- Verified long Chinese notifications at 1440 × 1000 and 390 × 844 with pointer and keyboard activation, no horizontal overflow, and no console errors.
- Re-ran the data-grid header regression to confirm titles and sort icons remain inline.

### Enforcement — exact incremental UI findings

- Upgraded `scripts/ui-stack-baseline.json` to version 2 with stable fingerprints over each finding's file, rule, and normalized evidence.
- Kept aggregate file/rule counts for reporting and backward compatibility while making exact fingerprints the active merge gate.
- Blocked same-count replacement debt, duplicate occurrences of an existing violation, and reintroduction of removed findings without coupling the baseline to line numbers.
- Added logic coverage for replacement, line movement, whitespace normalization, duplicate occurrences, and version-1 compatibility.
- Made the checked-in ordinary and i18n fingerprint baselines monotonic against the Git base: entries and occurrence counts may only stay flat or decrease, so code and baseline cannot grow together in one change.

### Pilot 1 — public actions and CMP Dashboard

- Approved and promoted `Button` and `IconButton` to `ready`.
- Migrated the CMP Dashboard retry action to `@project-wing/ui`.
- Replaced the page-specific `cmp-primary-button` override with semantic `fullWidth` and `size="lg"` props.
- Verified pointer and Space activation at 1440 × 1000 and 390 × 844 with no overflow or console errors.

### Sweep 1 — CMP route recovery actions

- Removed stale app-local Button imports from Acceptance, Clients, and Engagements after newer mainline work removed the obsolete recovery actions.
- Preserved the newer shared authentication boundary instead of replaying stale branch UI.
- Passed the complete CMP suite.

### Sweep 2 — CMP unavailable form routes

- Migrated `CmpFormRouteShell` from the CMP-local Button wrapper to `@project-wing/ui`.
- Replaced the transitional `ghost` name with canonical `quiet` for route-back actions.
- Replaced the unavailable-route `cmp-primary-button` escape hatch with semantic `fullWidth` and `size="lg"` props.
- Added component and real-browser evidence for pointer and Space navigation at 1440 × 1000 and 390 × 844.

### Sweep 3 — CMP client data-grid actions

- Migrated the Columns and New toolbar actions from CMP-local wrappers to the public Button.
- Replaced compatibility sizing with canonical `variant="outline"` and `size="md"` props.
- Removed CMP's direct TanStack table type import by deriving the toolbar table type from the public `ProjectWingDataGridToolbarProps` contract.
- Verified the Columns menu and New navigation with pointer and keyboard interaction at 1440 × 1000 and 390 × 844.

### Sweep 4 — CMP client preview action

- Migrated the client-name preview action and row-expansion/select primitives from CMP-local wrappers to the public `@project-wing/ui` boundary.
- Replaced the transitional `ghost` alias with canonical `variant="quiet"` and `size="md"`, retaining the accessible client-specific name and new-tab safety contract.
- Removed the column module's direct TanStack type import by deriving its column type from `ProjectWingMasterDataGridProps`.
- Verified pointer and Enter activation at 1440 × 1000 and 390 × 844, including destination routing, `noopener`, responsive containment, mocked-request completeness, and a clean browser console.

### Sweep 5 — CMP engagement preview action

- Migrated the engagement-code preview action to the public Button with canonical `quiet` and `md` props while leaving the adjacent icon-only edit action on its compatibility size until the IconButton tooltip contract is resolved.
- Removed the module's direct TanStack type import by deriving its column type from `ProjectWingMasterDataGridProps`.
- Verified the existing edit action still stops row preview, and verified preview pointer/Enter activation at 1440 × 1000 and 390 × 844 with the same route, new-tab safety, request, containment, and console assertions as the client slice.

### Accelerated sweep — CMP Toast adapter

- Routed ten CMP product consumers from direct Sonner imports through the existing `projectWingToast` public adapter.
- Kept the app-local Toaster implementation as the underlying design-system root and preserved every call site's existing API and behavior.
- Moved pure CMP deployment validation onto the frontend-only path and added a workflow contract assertion so API and database validation cannot be reintroduced silently.

### Accelerated sweep — unused CMP filter popover

- Confirmed the client-grid Filters popover had no importers and was not mounted in the product.
- Removed the unused component and its four private motion implementation files instead of migrating dead code.
- Reduced three direct underlying-library imports and one arbitrary-value finding without adding a new adapter or public API.

## Observed adjacent debt

- At 390px, the existing CMP AppShell topbar compresses and clips parts of its brand/navigation content. The completed Button sweeps do not change the topbar, and their migrated content does not overflow. Route this finding to AppShell responsive governance instead of expanding the Button migration.
- At 390px, the existing Engagement grid keeps too many columns visible, compressing header labels and cell values. Sweep 5 preserves that layout; route it to data-grid responsive governance instead of hiding columns inside a Button migration.
- At 1000px, the confirmation overview Count/Percentage control compresses its labels. The semantic-style migration does not change the control's width, tab composition, or label layout; route it to the Tabs/Button composition queue instead of hiding it inside the matrix token batch.

## Ordered cleanup queue

1. **Simple Button consumers.** Migrate text actions whose existing contracts map directly to `primary`, `secondary`, `outline`, `quiet`, or `danger`, and to `xs`–`lg` sizing.
2. **Icon-only actions.** Replace icon-sized Button usage with `IconButton`, supplying a stable accessible label. Do not preserve tooltip-only accessible names.
3. **Button composition.** Design, render, approve, and publish `ButtonGroup`, then migrate grouped and split actions without breaking focus order or responsive wrapping.
4. **Link and polymorphic actions.** Establish a public Link/action composition before touching consumers that rely on `render`, anchor semantics, or `buttonVariants` class generation.
5. **Form controls and overlays.** Promote Field/Input and Dialog/Sheet families before removing their app-local wrappers or direct underlying-library imports.
6. **Token debt.** Classify recurring arbitrary values and raw colors, add semantic tokens only where meaning is stable, then migrate by product surface.
7. **Native controls and specialized engines.** Replace confirmed primitive drift; retain documented adapters for viewers, grids, editors, and charts where a generic primitive is the wrong abstraction.

## Button migration blockers

The following patterns are not safe for mechanical replacement and must be routed to the appropriate capability work:

- `buttonVariants` used to style links or non-button elements;
- `render` or polymorphic composition that changes the semantic element;
- `size="icon*"`, tooltip props, or icon-only children without a stable label;
- ButtonGroup, split-button, toolbar roving focus, or attached-control layout;
- page-specific classes that encode a missing semantic variant rather than incidental layout;
- loading implementations whose duplicate-submission or announcement behavior differs from the public contract.

## Gate for every batch

```powershell
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json
node scripts/design-first/cli.mjs --json
corepack pnpm test:ui-stack
```

Also run the affected package's typecheck/tests, production build when CSS or Next.js integration changes, and a real-browser interaction check for visible or interactive UI changes.
