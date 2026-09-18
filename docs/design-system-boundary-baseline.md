# DesignFirst Boundary Baseline

Status: warning-level rules with a blocking monotonic baseline

Captured: 2026-08-14

Monotonic enforcement added: 2026-08-16

Configuration: [`design-first.boundary.json`](../design-first.boundary.json)

Registry: [`design-system.registry.json`](design-system.registry.json)

## Purpose

This report records the first DesignFirst boundary scan for ProjectWing. It is a measurement of existing UI debt, not an approval of the current UI. Individual boundary rules remain warnings so that historical debt can be migrated gradually, while the exact aggregate baseline is now a blocking CI gate: existing findings may remain or disappear, but no new fingerprint or repeated occurrence may enter the repository.

The scan covers the source roots of EMP, CMP, TMS, Intranet, IB, and the UI Showroom. Shared UI code and the existing app-local shadcn-compatible wrapper directories are treated as transitional design-system roots. New reusable capabilities should converge on the proposed `@project-wing/ui` public boundary rather than expand those transitional roots.

## Result

| Metric                     | Result |
| -------------------------- | -----: |
| Configuration valid        |    Yes |
| Files scanned              |    619 |
| Errors                     |      0 |
| Warnings                   |  1,707 |
| Registry components        |     81 |
| Registry errors / warnings |  0 / 0 |
| Ready components           |      0 |

The absence of ready components is intentional. A component can become ready only after it has a public export, showroom evidence, required-state coverage, and verification recorded in the registry.

## Pilot 1 closure: Button and IconButton

The user approved the rendered Button and IconButton pilot on 2026-08-14. Both capabilities are now `ready`; the design system as a whole remains `proposed`.

The first product adoption migrated the Dashboard retry action in `apps/cmp/src/app/[locale]/dashboard/page-client.tsx` from the app-local wrapper to the `@project-wing/ui` Button. The slice also removed its `cmp-primary-button` escape hatch in favor of the semantic `fullWidth` and `size="lg"` API.

Before adoption, the governance branch was synchronized with the latest `origin/main`. This matters because intervening product work changed both the scanned file count and the warning mix after the historical baseline was captured.

| Metric | Historical baseline | Synchronized main before pilot | After pilot / sweep 1 | After sweep 2 | After sweep 3 | Latest main / notification Patch | After sweep 4 | After sweep 5 |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| Files scanned | 619 | 641 | 641 | 642 | 642 | 648 | 648 | 648 |
| Errors | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Warnings | 1,707 | 1,682 | 1,678 | 1,677 | 1,676 | 1,677 | 1,676 | 1,674 |
| `direct-ui-import` | 144 | 144 | 144 | 144 | 143 | 143 | 142 | 141 |
| `relative-design-system-import` | 91 | 95 | 91 | 90 | 90 | 91 | 91 | 90 |
| Ready components | 0 | 0 | 2 | 2 | 2 | 2 | 2 | 2 |

The synchronized-main delta of six warnings is attributed to the completed governance sweeps: four in the pilot and sweep 1, one in sweep 2, and one in sweep 3. Changes between the historical baseline and synchronized main belong to other merged product work.

Product evidence includes a five-test CMP dashboard suite and a real-browser recovery flow at 1440 × 1000 and 390 × 844. Pointer click and Space activation both retried the request, no horizontal overflow was present, and no browser console errors were recorded.

## Sweep 1 delta: CMP route recovery actions

After synchronization, CMP Acceptance, Clients, and Engagements no longer contained recovery actions, but still retained unused app-local Button imports. The batch removed those three stale imports without reintroducing obsolete UI.

After sweep 1, the boundary result was 641 files, 0 errors, and 1,678 warnings. `relative-design-system-import` was 91, a reduction of four from the synchronized-main batch baseline.

## Sweep 2 delta: CMP unavailable form routes

`CmpFormRouteShell` now imports Button from the public `@project-wing/ui` boundary. Its route-back action uses canonical `quiet`, and its unavailable-route action replaces `cmp-primary-button` with semantic `fullWidth` and `size="lg"` props.

The added component test raises the scanned file count to 642. The current boundary result is 642 files, 0 errors, and 1,677 warnings. `relative-design-system-import` is now 90, so the batch removes one warning without adding another finding.

Product evidence covers the permission-denied client form route at 1440 × 1000 and 390 × 844. Pointer click and Space activation both returned to the client list, no horizontal overflow was present, and no browser console errors were recorded.

## Button regression patch: compound content

The shared Button label wrapper introduced during the pilot made compound children flow as blocks. CMP data-grid header buttons therefore placed their sort icon below the title. The Patch makes the wrapper an inline flex row at the shared component layer, preserving the public API and avoiding product-specific CSS.

Real-browser evidence checks unsorted and sorted headers at 1440 × 1000 and 390 × 844. The title and icon centers remain aligned on one row, with no horizontal overflow, unexpected requests, or console errors. This is a visual regression Patch, so it does not claim a boundary-warning reduction.

## Notification regression patch: stacked domain content

The inline Button label fix exposed an invalid assumption in the CMP notification card: its title, body, and metadata were three direct Button children and therefore became horizontal flex items. The notification Patch wraps those regions in one domain-owned grid container. The shared Button API and compact inline-content behavior remain unchanged, and CMP does not depend on the internal `.pw-button-label` selector.

Real-browser evidence uses realistic long Chinese notifications at 1440 × 1000 and 390 × 844. It asserts the title, body, and metadata are vertically ordered and contained by the notification card, exercises pointer and Space activation, and records no overflow or console errors. The existing data-grid header regression also passes, proving the earlier horizontal compound-content fix remains intact.

The Patch is based on `origin/main` at `0cca16d4`. Its boundary result is 648 files, 0 errors, and 1,677 warnings, with 143 `direct-ui-import` and 91 `relative-design-system-import` findings. Intervening product work accounts for the change from the sweep-3 score; the notification Patch adds no finding.

## Sweep 3 delta: CMP client data-grid actions

The client data-grid Columns and New actions now use the public Button with canonical `outline` and `md` props. `CmpDataGridToolbar` also consumes the public column-visibility component and derives its table type from `ProjectWingDataGridToolbarProps`, removing its direct TanStack import without extending the public API.

The current boundary result is 642 files, 0 errors, and 1,676 warnings. `direct-ui-import` is now 143, so this sweep removes one warning without adding another finding.

Product evidence covers pointer interaction at 1440 × 1000 and keyboard interaction at 390 × 844. Both paths open the Columns menu and navigate through New, with no horizontal overflow, unexpected requests, or console errors.

## Sweep 4 delta: CMP client preview action

The client-name preview action now consumes the public Button with canonical `quiet` and `md` props. The same column module consumes public row selection/expansion primitives and derives its column type from `ProjectWingMasterDataGridProps`, removing the remaining direct TanStack import from that module without extending the public API.

The branch is synchronized to `origin/main` at `f2bf8b0a`. The boundary result remains 648 files and 0 errors while warnings fall from 1,677 to 1,676. `direct-ui-import` falls from 143 to 142, and no other rule count increases.

Product evidence covers pointer activation at 1440 × 1000 and Enter activation at 390 × 844. Both paths open the correct Client profile in a new tab without retaining `window.opener`; the source grid and destination remain contained, every API request is mocked, and no console errors are recorded.

## Sweep 5 delta: CMP engagement preview action

The engagement-code preview action now consumes the public Button with canonical `quiet` and `md` props. The same module derives its column type from `ProjectWingMasterDataGridProps`, removing both its relative Button import and direct TanStack type import without extending the public API. Its icon-only edit action keeps its existing tooltip and compatibility size until that IconButton contract is ready for migration.

The branch is synchronized to `origin/main` at `d8e1bca4`. The boundary result remains 648 files and 0 errors while warnings fall from 1,676 to 1,674. `direct-ui-import` falls from 142 to 141 and `relative-design-system-import` falls from 91 to 90; no other rule count increases.

Product evidence covers pointer activation at 1440 × 1000 and Enter activation at 390 × 844. Both paths open the correct Engagement profile in a new tab without retaining `window.opener`; the source grid and destination remain contained, every API request is mocked, and no console errors are recorded. The existing narrow Engagement grid column compression is recorded as adjacent responsive debt rather than hidden inside this Button batch.

## Batch sweep delta: CMP public imports

The first accelerated green batch migrates public Badge, Button, ButtonGroup, Checkbox, Frame, Input, and Select consumers across 14 CMP component modules. It changes only import boundaries; component implementations, props, styling, and interaction behavior remain unchanged. App-local components that do not yet have approved public contracts, including Accordion, Dialog, NativeSelect, Tabs, and Textarea, remain on their existing imports for later capability-level migrations.

The synchronized-main batch baseline was 649 files, 0 errors, and 1,669 warnings. After the batch, the scan remains at 649 files and 0 errors while warnings fall to 1,636. `relative-design-system-import` falls from 86 to 53, a net reduction of 33, and no other rule count increases.

## Batch sweep delta: CMP Toast adapter

The next accelerated batch routes ten CMP Toast consumers through the existing `projectWingToast` public adapter. The adapter is a direct re-export of the same Sonner object, so call sites, options, rendering, timing, and interaction behavior remain unchanged. The app-local Toaster implementation remains a design-system root and continues to own its direct Sonner dependency.

The scan remains at 649 files and 0 errors while warnings fall from 1,636 to 1,626. `direct-ui-import` falls from 140 to 130, a net reduction of 10, and no rule count increases. A clean scan of the synchronized `HEAD` also corrects the previous report's attribution of one of those 140 findings to a non-configured `locale` rule.

## Batch sweep delta: unused CMP filter popover

The CMP client-grid filter popover and its four app-local motion helpers had no importers and were not mounted in the product. The batch removes that dead subtree instead of migrating an unused surface onto the public API.

The scan falls from 649 to 644 files and from 1,626 to 1,622 warnings. `direct-ui-import` falls from 130 to 127, `arbitrary-value` falls from 1,143 to 1,142, and no rule count increases.

## Batch sweep delta: cross-app Toast boundary and dead UI islands

Nine active EMP and TMS Toast consumers now use the existing public `projectWingToast` adapter. TMS also replaces its direct Sonner Toaster with `ProjectWingToaster`; both use the same Sonner implementation and preserve the existing `top-center` position. The same batch removes 19 component modules whose TypeScript dependency graph has no inbound edge and whose paths and exported symbols have no static, dynamic, barrel, test, or route reference.

The scan falls from 644 to 625 files and from 1,622 to 1,571 warnings. `direct-ui-import` falls from 127 to 114, `relative-design-system-import` falls from 53 to 44, and `arbitrary-value` falls from 1,142 to 1,113. No rule count increases. The exact fingerprint baseline is regenerated from the reduced tree and passes the monotonic comparison with `origin/main`, so removed debt cannot be reintroduced as accepted historical debt.

## Batch sweep delta: CMP and EMP icon actions

Six active CMP and EMP icon-action consumers now use the approved public `IconButton`. Stable accessible names, disabled behavior, callbacks, and existing external Tooltip ownership remain intact. The EMP-local 28px `icon-sm` contract maps to public `xs`; the CMP fee-row delete action retains its 36px target through public `md`.

The batch also hardens the public IconButton CSS contract: each named size now has equal fixed width, minimum width, and maximum width, while the component-specific selector reliably removes text-button padding. This prevents narrow table cells from compressing the hit target or leaving an icon to render through padding overflow.

The synchronized `origin/main` scan covers 627 files with 1,579 warnings. The batch remains at 627 files and lowers warnings to 1,573; `relative-design-system-import` falls from 48 to 42 and no other rule count increases. Real-browser evidence covers EMP preview file and panel actions plus the CMP fee-row delete action at desktop and 390 × 844. Public `xs` remains 28px square, public `md` remains 36px square, Tooltip text and keyboard activation remain available, and neither product page gains document-level horizontal overflow.

## Batch sweep delta: CMP grid and Input boundary

Five CMP grid modules now derive column, filter, and table types from public data-grid component contracts instead of importing TanStack types directly. The client grid also reuses the public selected-values filter rather than maintaining an identical product-local implementation. Two engagement modules bypass re-export-only local Input wrappers and import the same public Input directly.

The synchronized `origin/main` scan covers 627 files with 1,573 warnings. The batch remains at 627 files and lowers warnings to 1,565; `direct-ui-import` falls from 114 to 108, `relative-design-system-import` falls from 42 to 40, and no other rule count increases.

## Batch sweep delta: CMP accessible names

The notification drawer, notification read-state icon, and boolean indicator now use their native `aria-label` contracts directly. This removes the CMP-local `AccessibleName` wrapper instead of promoting an unapproved private abstraction into the public package. A focused boolean-indicator test covers both accessible states, while the existing AppShell test continues to resolve the notification drawer by its accessible dialog name.

The synchronized `origin/main` scan covers 627 files with 1,565 warnings. The batch remains at 627 files and lowers warnings to 1,563; `relative-design-system-import` falls from 40 to 38, and no other rule count increases.

## Batch sweep delta: CMP shadow color tokens

Thirty-six repeated slate and black shadow/overlay colors in the CMP stylesheet now reference three CMP-owned semantic shadow tokens. The token definitions deliberately retain the exact original RGB channels; the batch therefore consolidates repeated debt without introducing the one-channel color drift present in the current Tailwind slate palette. The three token definitions remain visible raw-color findings for a later palette-alignment decision rather than being hidden through an exception.

The synchronized `origin/main` scan covers 627 files with 1,563 warnings. The batch remains at 627 files and lowers warnings to 1,530; `raw-color` falls from 208 to 175, a net reduction of 33, and no other rule count increases. Production-browser evidence covers the notification drawer at 1440 × 1000, 390 × 844, and night appearance plus the client-grid Columns popover at desktop and narrow widths. Overlays, shadows, content containment, keyboard activation, and document width remain intact with no console or unexpected-request failures.

## Batch sweep delta: Intranet public color tokens

All 41 Intranet theme, attachment-type, and link colors now resolve through public `@project-wing/ui` CSS custom properties. The public boundary retains the exact original light and dark values; application CSS contains only semantic references. A focused contract test locks all 41 references and 33 distinct public definitions. The root layout also passes the server-selected theme into the client provider, eliminating the mocha login hydration mismatch exposed by the browser gate.

The synchronized `origin/main` scan covers 633 files with 1,530 warnings. The contract test raises the scan to 634 files while warnings fall to 1,489; `raw-color` falls from 175 to 134, a net reduction of 41, and no other rule count increases. CI now classifies `packages/ui` as shared frontend input for CMP/UI governance checks, while a workflow contract locks the existing six-consumer deployment mapping. Production-browser evidence verifies public-to-semantic color resolution at 1440 × 1000 in latte and mocha and at 390 × 844 in latte, with no hydration, request, console, or overflow failures.

## Batch sweep delta: EMP public color tokens

All 43 raw colors in the EMP application stylesheet now resolve through either mathematically identical Tailwind black and white values or named `@project-wing/ui` CSS custom properties. The public boundary retains all 23 exact brand, Slate, preview, spreadsheet, scrollbar, and smart-form light/dark values, while the app keeps semantic aliases for consumers. A focused theme contract rejects raw application colors, counts the 25 public references, and locks every public definition.

The synchronized `origin/main` scan covers 636 files with 1,495 warnings. The batch remains at 636 files and lowers warnings to 1,452; `raw-color` falls from 134 to 91, a net reduction of 43, and no other rule count increases. Production-browser evidence verifies exact computed alias/public values and zero document overflow at 1440 × 1000 in latte and mocha plus 390 × 844 in latte. Visual inspection found no layout or theme regression; the only console failures were the expected development auth requests while the local API was intentionally not running.

## Batch sweep delta: CMP public color tokens

All 35 raw colors in the CMP application stylesheet now resolve through either mathematically identical Tailwind white or named `@project-wing/ui` CSS custom properties. The public boundary retains 24 exact login, shadow, success, and approval-state values, while the application keeps its existing semantic aliases and rule structure. The CMP shell contract rejects raw application colors, counts the 28 public references, retains the 36 existing shadow-alias consumers, and locks every public definition.

The synchronized `origin/main` scan covers 636 files with 1,452 warnings. The batch remains at 636 files and lowers warnings to 1,417; `raw-color` falls from 91 to 56, a net reduction of 35, and no other rule count increases. Production-browser evidence verifies exact computed shadow aliases and representative login/approval values, the real light/dark toggle, and zero document overflow at 1440 × 1000 plus 390 × 844. Visual inspection found no layout or theme regression; the only console failures were the expected development auth requests while the local API was intentionally not running.

## Batch sweep delta: EMP CSV canvas palette adapter

The EMP CSV viewer's Glide renderer cannot safely consume unresolved CSS `var(...)` values because its theme colors are painted into a canvas. Its 31 light/dark raw colors now live as 16 semantic public tokens, while `readCanvasDataGridPalette` reads the active computed values into the same concrete strings previously supplied by the component. The adapter has no Glide dependency, so the public boundary owns palette resolution without taking ownership of the specialized engine.

The synchronized `origin/main` scan covers 638 files with 1,382 warnings after intervening product work. This batch remains at 638 files and lowers warnings to 1,351; `raw-color` falls from 56 to 25, a net reduction of 31, and no other rule count increases. The specialized viewer remains intentionally outside the general UI-stack fingerprint scan, so its focused EMP source contract provides the monotonic guard: it rejects any future raw hex color in the file. Unit coverage also locks all 16 adapter roles, its server-safe fallback, and all 31 exact public light/dark definitions.

## Batch sweep delta: EMP confirmation overview matrix semantic styles

The confirmation overview matrix now owns its established geometry and motion through semantic CSS Module classes instead of 36 production arbitrary utilities. Four table widths, the dense-stage width, sticky header and total-row backgrounds, shadows, transition properties, stagger delays, and reduced-motion duration retain their exact prior values. Fourteen test findings disappeared with the old utility-string implementation assertions; replacement tests assert semantic width/sticky states, while a focused source contract locks every migrated CSS value.

The synchronized `origin/main` scan covers 638 files with 1,351 warnings. The two focused style/contract files raise the scan to 640 files while warnings fall to 1,301; `arbitrary-value` falls from 1,081 to 1,031, a net reduction of 50, and no other rule count increases. Browser evidence verifies count/percentage switching, both disclosure groups, 88rem and 64rem computed widths, and the fixed first column after 474px of horizontal scrolling at 1440 × 1000 and 1000 × 800 with zero console errors. The existing Count/Percentage label compression at 1000px is recorded as adjacent Tabs/Button composition debt rather than bundled into this value-preserving batch.

## Batch sweep delta: EMP confirmation editor semantic geometry

The active project confirmation editor now owns its established shell, template popover bounds, standard PDF digital twin, and managed DOCX fallback geometry through semantic CSS Module classes. The migration preserves the two editor row layouts, nine PDF fields, ten DOCX fallback fields, 8px/10px overlay typography, and the bank-name source cover. Browser verification exposed a collapsed selector at 1000px, so the semantic template control now has an 18rem minimum width and lets the existing toolbar scroller handle the remaining actions. Retired PRC Template 1, PRC Template 2, and ShineWing renderers and their implementation-coupled tests are removed.

The synchronized `origin/main` scan covers 655 files with 1,448 warnings after the weekly confirmation-template work. The focused stylesheet and contract raise the scan to 657 files while warnings fall to 1,322; `arbitrary-value` falls from 1,154 to 1,028, a net reduction of 126, and no other rule count increases. The production editor accounts for 103 removed findings and its tests account for 23. Unexpected retired codes now return to active template selection instead of rendering legacy UI. The synchronized managed-template catalog, information-library lookup, dynamic field designs, and custom DOCX upload remain available. API-side historical document rendering compatibility remains intact for archived artifacts. Browser evidence at 1440 × 1000 and 1000 × 800 confirms that the catalog exposes Custom upload plus four current managed templates and no retired option, all nine standard PDF overlays retain their exact geometry, the edited bank value remains visible, the template control stays operable through toolbar scrolling, document overflow remains zero, and the console records zero errors.

## Batch sweep delta: EMP confirmation overview shell geometry

The confirmation-center overview now owns its navigation rail widths, motion, table proportions, progress-label typography, and loading-row grid through a surface-owned CSS Module. All eighteen 184–320px navigation steps remain available at the established 8px interval. Runtime coverage now asserts semantic navigation state and rendered width rather than Tailwind implementation strings, while a focused source contract locks every migrated value.

The synchronized `origin/main` scan covers 657 files with 1,322 warnings. The stylesheet and focused contract raise the scan to 659 files while warnings fall to 1,283; `arbitrary-value` falls from 1,028 to 989, a net reduction of 39, and no other rule count increases. Browser evidence at 1440 × 1000 and 1000 × 800 confirms 256px default, 0px collapsed, and 320px dragged navigation states; a 992px table remains contained by its 730px narrow scroller; table proportions and progress stages remain visually intact; document overflow stays zero; and the final console records zero errors and zero warnings.

## Batch sweep delta: EMP Smart Form V2 shared table colors

The Smart Form V2 editor and read-only renderer now share a surface-owned semantic stylesheet for table headers, grouped rows, group accents, and interactive table colors. The migration preserves the existing token references, the 70% grouped-section surface, the 55% normal-row hover surface, and the distinction between logical start and physical left borders. A focused source contract requires both renderers to consume the shared module and rejects reintroduced table-color arbitrary values in JSX.

The synchronized `origin/main` scan covers 659 files with 1,283 warnings. The stylesheet and focused contract raise the scan to 661 files while warnings fall to 1,244; `arbitrary-value` falls from 989 to 950, a net reduction of 39, and no other rule count increases. The editor accounts for 22 removed findings and the read-only renderer accounts for 17. Browser evidence at 1440 × 1000 and 1000 × 800 confirms the exact computed header, border, foreground, group, accent, and hover colors in both modes; the 848px narrow table remains inside the viewport. A 700 × 800 mobile check confirms normal cards remain uncolored while only group cards receive the 2px accent and grouped surface. Document overflow stays zero at every viewport, and the final console records zero errors and zero warnings. The dev server's existing `::highlight(project-document-search)` parser notice is unrelated to the touched files and remains adjacent stylesheet-tooling debt.

## Batch sweep delta: EMP confirmation editor remaining semantic styles

The confirmation editor's three managed `SelectValue` trigger variants and seven securities fallback rectangles now use the editor's existing surface-owned CSS Module. The select contract preserves Tailwind's compiled behavior exactly: block layout, horizontal box orientation, no line clamp, hidden overflow, and clipped text. The fallback rectangles retain all existing percentage coordinates and the shared 2.2% height. Runtime tests now assert the semantic select class instead of Tailwind descendant-selector strings, while the source contract locks every declaration and fallback coordinate.

The synchronized `origin/main` scan covers 661 files with 1,244 warnings. This batch remains at 661 files while warnings fall to 1,205; `arbitrary-value` falls from 950 to 911, a net reduction of 39, and no other rule count increases. Production code accounts for 37 removed findings and the implementation-coupled test accounts for two. The local account service could not start without the repository's database environment, so rendered verification used a temporary, uncommitted Next.js dev harness that loaded the real compiled CSS Module. At 1440 × 1000 and 1000 × 800, the long select value clips from a 431px scroll width to a 142px client width, all seven rectangles resolve to the prior percentage geometry, document overflow remains zero, and the browser console records zero errors and zero warnings. The harness was deleted before the final scan.

## Batch sweep delta: EMP workbench directory row states

Workbench directory rows now own active, drag-over, selected, multi-selected, and highlighted-file layers through a surface-owned CSS Module. Existing `data-active` state remains the source of truth. The migration consolidates the 15% active tint, 20% hover tint, 10% dashed drop target at z-index 10, stable brand tint, selected 2px indicator, and file highlight pseudo-elements. Rename-dialog columns, file-code typography, and icon motion remain in the source for later classification instead of being bundled into this state-only batch.

The synchronized `origin/main` scan covers 661 files with 1,205 warnings. The stylesheet and focused contract raise the scan to 663 files while warnings fall to 1,158; `arbitrary-value` falls from 911 to 864, a net reduction of 47, and no other rule count increases. Production code accounts for 42 removed findings and five implementation-coupled directory tests account for the remainder. Seventy-eight focused directory/style tests preserve selection and context-menu state wiring. A temporary, uncommitted Next.js harness loaded the real compiled CSS Module at 1000 × 800 and confirmed all rest, hover, drop, selected, and file-highlight computed styles, zero document overflow, and zero browser console errors or warnings. The harness was deleted before the final scan.

The active migration order and blockers are recorded in [`design-system-cleanup-plan.md`](design-system-cleanup-plan.md).

## Findings by rule

| Rule | Findings | Initial interpretation |
| --- | --: | --- |
| `arbitrary-value` | 864 | Token coverage and layout conventions are the largest governance gap. Classify recurring dimensions before replacing them. |
| `raw-color` | 25 | Product code contains colors that should be mapped to semantic tokens or documented adapter needs. |
| `direct-ui-import` | 109 | Product code reaches third-party UI engines directly; migrate reusable behavior behind public components or named adapters. |
| `relative-design-system-import` | 52 | Applications import local wrapper internals; converge capability by capability on the public package. |
| `native-interactive` | 65 | Review native controls for missing shared behavior, keyboard states, and consistent styling. |
| `inline-style` | 40 | Separate truly dynamic geometry from static styling that belongs in tokens or component variants. |
| `local-reusable-ui` | 3 | Review suspicious app-local primitives before they become additional unofficial systems. |

These are lexical findings, not 1,707 confirmed defects. Each migration slice must inspect context before changing code. In particular, document viewers, data grids, editors, charts, and other specialized engines may require named adapters rather than general-purpose primitives.

## Highest-concentration files

| File                                                  | Findings |
| ----------------------------------------------------- | -------: |
| `apps/emp/src/components/workbench-paper-section.tsx` |      101 |
| `apps/tms/src/components/approval-workspace.tsx`      |       82 |
| `apps/emp/src/views/projects.tsx`                     |       71 |
| `apps/tms/src/components/timesheet-workspace.tsx`     |       64 |
| `apps/emp/src/components/workbench-directory-row.tsx` |       49 |
| `apps/emp/src/components/extend/pdf-viewer.tsx`       |       43 |
| `apps/emp/src/components/smart-form-v2-editor.tsx`    |       11 |

The largest file is not automatically the first migration target. A good first slice should be visible, repeated, low-risk, and small enough to establish the public API, showroom, test, and adoption workflow end to end.

## Enforcement posture

- Keep every DesignFirst boundary rule at `warning` during the reporting phase.
- Keep DesignFirst in the existing UI-governance workflow; do not add a competing CI workflow.
- Require `scripts/design-first-baseline.json` to exactly equal the current scan. A reduction must update the checked-in low-water mark in the same PR.
- Compare every changed baseline with the event base by file, rule, normalized-message fingerprint, and occurrence count. New evidence, moved debt, and increased repetitions fail even when the total warning count is unchanged.
- Re-run the same exact scan after each matching `main` push so the merged low-water mark remains observable and protected.
- Do not add broad or permanent exceptions from this baseline. Exceptions require an owner, reason, expiry or explicit permanence, and user approval.
- Do not lower the baseline by hiding findings. Reduce it through reviewed tokens, components, adapters, and migrations.
- Promote individual rules or scoped roots to blocking only after the affected historical debt is removed or explicitly governed.

## Reproduce

```powershell
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json
node scripts/design-first/cli.mjs --json
node scripts/design-first-baseline.mjs
```

After an intentional cleanup, refresh the lower exact baseline with `node scripts/design-first-baseline.mjs --update-baseline`. The baseline diff must contain only removed findings or reduced occurrence counts relative to the PR base.

The next governance step is to continue the ordered, capability-by-capability queue without increasing the synchronized boundary baseline.
