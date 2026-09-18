# Touch-first EMP proposal

Status: **Experimental / proposed, not approved for product adoption**. 2026-09-10.

## Intent

Keep the existing green, neutral enterprise palette and shared data/permission model. Replace compressed desktop navigation with phone-oriented task flows. This is a responsive web experience, not a commitment to ship an iOS/Android binary or a second API.

First integration specimen: projects → working papers → reading layout → a review-note conversation. The user has now explicitly required **full operation parity**: mobile changes the interaction, not the available business operations. [The parity checklist](mobile-operation-parity.md) records required coverage and incomplete integration; mobile editing, SmartForm authoring, project administration and native-file workflows must not be silently removed.

## Productivity-tool reference direction (user refinement)

The user clarified that the reference should be established productivity tools adapted for phones, rather than only general mobile-app navigation. The first specimen establishes touch targets and basic navigation; it does not yet demonstrate a complete mobile productivity workbench.

Verified primary references and proposed applications:

| Reference | Documented mobile behavior | Proposed EMP application, not an implemented claim |
| --- | --- | --- |
| [Word mobile ribbon](https://support.microsoft.com/en-gb/office/show-or-hide-the-ribbon-in-word-for-mobile-devices-b8a5b4c3-a187-45b7-a945-718e0524bfe1) | Reading can reclaim space by hiding the ribbon; editing exposes commands on demand. | Distinct reading, commenting and editing modes. Keep relevant commands near the active content instead of permanently displaying the desktop command bar. |
| [Notion mobile](https://www.notion.com/help/notion-for-mobile) | Desktop columns become one column; actions that rely on desktop hover have visible mobile controls. | Keep project/document hierarchy and explicit overflow actions. Replace side-by-side panels with navigable views while preserving the selected object and return location. |
| [Linear mobile](https://linear.app/mobile) | Mobile workflows emphasize actionable inbox items, comments, issue updates and compact document reading. | Let a work item open its exact project/file/question context, support taking action there, and return to the previous queue position. Do not copy Linear's scope restrictions automatically. |
| [OneDrive Android PDF markup](https://support.microsoft.com/en-us/onedrive/mark-up-a-pdf-in-onedrive-for-android) | PDF markup tools are entered explicitly; selected markup types expose relevant commands. | Make the document the primary canvas, with explicit comment/edit entry and selection-specific tools. Audit Notes remain linked business discussions, not an automatic conversion into arbitrary PDF drawing annotations. |

Next iteration priorities:

- Retain compact, legible lists with file identity, reference code and meaningful state; avoid oversized decorative cards and repeated metadata.
- Demonstrate real project → folder → workpaper navigation and a location switcher, not only a flat recent-project list.
- Establish separate reading, discussion and editing modes. A persistent global tab bar must not compete with the document's own active toolbar or the keyboard.
- Preserve selection, scroll position and draft state when moving between a document, a referenced attachment and its Notes. The current in-memory sample is not a durable-draft implementation.
- Define explicit multi-select mode and a scoped batch-action bar rather than relying solely on long press, hover or hidden gestures.
- Keep tabular comparisons as bounded tables where row/column relationships matter; a form-like row editor may complement them. Do not convert every SmartForm table to cards.
- Distinguish phone navigation from tablet split-view and desktop density. Breakpoint adaptation must preserve the same project data and permissions.
- Inventory all existing actions before deciding any mobile exclusions. A narrow browser window is not evidence that Desktop Agent exists or does not exist; local-file capability detection remains independent of layout.

This refinement changes the proposed design direction only. It is not approval of a finished visual system or authorization to remove existing functionality. No product UI changed in this reference-review pass.

## Code findings from the first inspection

- `apps/emp/src/views/projects.tsx` hides the folder rail at narrow widths but keeps desktop workbench/table and multi-column creation/dialog structures.
- The existing top bar solves competing horizontal space through collapse/expansion; it does not establish stable touch-first navigation.
- `packages/ui/src/settings-dialog-shell.tsx` adapts a desktop modal/side-navigation structure. A near-fullscreen dialog alone does not provide a mobile detail-navigation model.
- The current design contract is explicitly desktop-primary for EMP/CMP/TMS. Phone support needs a material interaction proposal, not a blanket change to desktop density.

## Proposed interaction contract

1. Primary destinations: Projects / Tasks / Account. Secondary destinations belong in the appropriate section, not a permanent strip of desktop commands.
2. Phone: one primary surface at a time. Rows open a detail screen; explicit Back and browser history remain available. Tablet split views and desktop multi-pane layouts can retain denser structures.
3. List rows prioritize identity, relevant context and state. Secondary fields move to details; a table may still scroll inside its own bounded region when tabular comparison is essential.
4. Short selection/actions use a bottom sheet with a visible close control, modal focus containment and Escape support. Long forms should be full pages. Do not imply swipe support with a decorative handle.
5. Review notes use a dedicated conversation surface with a bottom composer. File/working-paper references share icon + name + theme color. Attachments are not forced into inline thumbnails.
6. The initial proposal used 48 CSS px primary targets. The user's 2026-09-10 density revision supersedes that baseline in compact mobile surfaces: 40px single-line fields, 44px icon/action targets, 16px editable text, reduced stacked spacing and predominantly flat lists/forms. Comfortable density retains its existing larger spacing. These are project design choices, not a claim that WCAG AA requires a particular 40/44/48px size. See [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
7. Stable primary destinations follow the general predictability principle in [Apple tab bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars). The proposal uses web links and browser history, not platform-exclusive UI behavior.
8. Safe-area padding, dynamic viewport sizing, long filenames, zoom, reduced motion, keyboard visibility, selection mode and interrupted requests belong in the acceptance matrix. Desktop viewport simulation is not proof of real Safari/Android keyboard behavior.

## Ownership and samples

- Opt-in shared experimental components in `packages/ui/src/mobile-workspace.tsx`: MobileScaffold, MobilePageHeader, MobileNavigation, MobileListItem, MobileActionSheet, MobileSelectionRow and MobileComposer. The second iteration adds compact density, contextual document-mode navigation and explicit selection mode. Existing shared `ProjectWingMasterDataGrid` renders tabular relationships; no replacement table primitive is introduced.
- All business fixtures stay in the showroom. No EMP route, global desktop layout or production permission behavior is changed.
- Component catalog: `/mobile`; fixture-driven composition: `/specimens/MobileWorkspace`.
- The reading page is explicitly a layout specimen, not an actual PDF renderer. Version 2 uses project/file/question-scoped routes and session storage for synthetic replies, drafts, file placement and sample form values. Multiple questions are independently addressable; production permission checks, real upload/download, rich-text handling and recovery still require integration.
- Existing showroom and registry completeness problems must not be hidden by declaring these new components Ready. This proposal remains Experimental until the required design-system and device checks are satisfied.

## Validation

- `corepack pnpm --filter @project-wing/ui test src/mobile-workspace.test.tsx`: **4 passed** (real-link navigation/current page, row and action separation, named back link, footer placement).
- `corepack pnpm --filter @project-wing/ui lint` and `corepack pnpm --filter @project-wing/ui-showroom typecheck`: passed.
- Scoped `corepack pnpm exec ultracite check` on the new shared mobile source/test/CSS, package export, both specimen components and the two new routes: passed; `git diff --check`: passed.
- Scoped `runAudit` from `scripts/design-first/cli.mjs` on the new showroom routes and compositions: clean, zero findings.
- `node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --require-ready --json`: **not passed, 782 findings** at the initial proposal scan. This includes existing registry debt and incomplete readiness evidence for the five experimental additions; no status was promoted to Ready and no baseline was relaxed. This blocks a formal design-system approval/product-adoption claim.
- Live showroom: `corepack pnpm --filter @project-wing/ui-showroom exec next dev --hostname 127.0.0.1 --port 3047`; initial generated docs source via `corepack pnpm --filter @project-wing/ui-showroom exec fumadocs-mdx`.
- Playwright CLI session `mobile-proposal`: inspected `/specimens/MobileWorkspace` at 390×844 and 320×740, including dark project list, note reply, local draft retained after navigating away/back, no page-level horizontal overflow (`scrollWidth` equals 390 and 320 respectively). Inspected `/mobile` at 1440×900.
- Bottom-sheet keyboard check: Tab cycles remain within the dialog after focus-management settling; Escape closes and restores focus to its invoking button. An initial immediate-per-keystroke assertion observed a transitional focus guard; the settled-focus test passed. No changes to the underlying focus trap were needed.
- Fixed a Base UI link/button semantics warning by declaring rendered anchors non-native buttons. A test interrupted during hot refresh was rerun after navigation; the successful stable run is recorded separately, not counted as success for the failed attempt.
- Screenshots: `docs/evidence/mobile-app-experience/mobile-projects-390.png`, `mobile-notes-390.png`, `mobile-notes-320.png`, `mobile-projects-dark-320.png`, `mobile-sheet-390.png`, `mobile-catalog-1440.png`.

No production build, PR, merge, deployment, backend-connected acceptance, real PDF rendering, file upload/download or real-device keyboard/safe-area acceptance has been performed for this proposal. Version 2 preserves synthetic drafts/replies across refresh in the same browser tab, with an explicit memory-only warning if storage fails. Cross-device persistence and real business authorization remain integration work. The user has required complete operation parity, not a reduced mobile feature set.

## Productivity iteration — implementation and evidence

The user approved proceeding with the productivity-tool direction and explicitly required all operations to remain available through mobile-appropriate interaction. This is approval of the direction, not a claim that the complete mobile version or design registry is finished.

- Project → folder → file navigation now encodes identity in the URL; opening a file opens that file, with separate note shortcuts.
- Reading/discussion/editing modes share the same file context. Back navigation uses the in-app history when present and a safe parent destination for direct links.
- Drafts and replies are isolated by project, file and question. Q1/Q2/Q3 are separate threads. Attachment navigation returns to the originating question without clearing its draft.
- Explicit selection mode uses checkbox rows and a scoped move destination. The fixture store rejects invalid destinations and moves only selected files in the current project/source directory.
- The reading view retains a real shared table, with bounded horizontal scrolling. The sample editor permits focused row entry and explicitly saves only synthetic values.
- Directory scroll positions are remembered without rerendering on each scroll event; values are flushed on navigation. Search and the project filter are session-scoped.
- `apps/emp/src/lib/mobile-operation-parity.ts` provides exhaustive mappings for the current directory/content callback types, search-file action union and project permission action union. Its entries are design obligations, not wired business handlers. Remaining coverage is recorded in [the full-parity checklist](mobile-operation-parity.md).

Commands executed for this iteration:

```powershell
corepack pnpm --filter @project-wing/shared build
corepack pnpm --filter @project-wing/emp test src/lib/mobile-operation-parity.test.ts
corepack pnpm --filter @project-wing/ui test src/mobile-workspace.test.tsx
corepack pnpm --filter @project-wing/ui-showroom test:mobile
corepack pnpm --filter @project-wing/emp lint
corepack pnpm --filter @project-wing/ui lint
corepack pnpm --filter @project-wing/ui-showroom typecheck
```

Results: parity requirements 2 tests passed; shared mobile controls 6 passed; model 10 passed, including two navigation-trail regression cases. Typechecks passed after building the existing shared-package exports and adding Vitest as an explicit showroom test dependency. The lockfile change is limited to the showroom Vitest importer; unrelated dependency-resolution churn was restored, and the filtered offline frozen-lockfile installation succeeded.

Interactive evidence uses the isolated local showroom and the owned `mobile-proposal` browser session, not production data. Verified: Q1 draft survives attachment navigation; Q2 does not inherit Q1 text; Q2 multiline draft survives refresh; dropdown row editing and save survive refresh. At 320px, the page width remains 320px while the table has a 277px scroll viewport over 500px of content. A nested Select initially appeared behind the new mobile sheet; aligning the sheet with the existing overlay layer fixed actual pointer access, and the click/save/refresh sequence passed afterward. Same-URL hash navigation does not reset open dialogs; a test that assumed it did was corrected rather than counted as successful.

Further verification: selecting two PDFs and confirming a move removes them from Orchid's cash folder and shows them in its receivables folder. A separate URL-and-project-identity-checked visit to Harbour confirms both corresponding files remain in its cash folder and no selection leaks across projects. A first check that only looked for filenames could not prove project identity and was superseded by this stronger check. The checkbox's duplicate accessible label was removed; the enclosing label now names the whole row.

Navigation testing exposed a wrong return destination after mixing direct fragment navigation with custom history state. The specimen now uses native fragment navigation, tracks its own visited trail, ignores the server's initial placeholder route during hydration, and resets that trail on direct-link fallback. Regression tests cover the phantom-entry case and backward/forward traversal. Browser verification returned to the correct Harbour folder with its scroll position preserved (51.28px before and after), and a fresh direct link returned through Harbour's project root to Projects rather than an unrelated project's history entry. These are prototype-navigation tests, not proof of production routing integration.

Version 2 visual evidence: `mobile-v2-directory-390.png`, `mobile-v2-reading-390.png`, `mobile-v2-reading-320.png`, `mobile-v2-question-390.png`, `mobile-v2-edit-320.png`, `mobile-v2-selection-320.png`, `mobile-v2-move-320.png`, `mobile-v2-moved-320.png` under `docs/evidence/mobile-app-experience/`.

The production functionality-parity gate is still open. No missing operation is waived, no placeholder button is counted as implemented, and no shared component is promoted to Ready by this iteration.
