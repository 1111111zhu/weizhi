# Intranet mobile navigation prototype

Status: **Proposed navigation, interactive prototype only**. The user requested a four-entry home and progressive knowledge categories, then asked to start the prototype. This is not approval to replace the live application or desktop navigation.

Open `/specimens/MobileIntranet` on the existing Showroom (`http://127.0.0.1:3047`). It is linked from `/specimens/MobileMaterialSystem`; the component catalog remains the primary design-system surface.

## Structure

- Home: EMP, CMP, TMS and Knowledge Center, in a two-column icon grid. The three application links open existing local mock pages in a new tab; no production URL is assumed.
- Knowledge Center: Admin, HR, Finance, QM and IT. One level of categories is visible at a time; deeper groups follow the existing Intranet taxonomy.
- Leaf categories: files and notices. Search is scoped to the current branch, including descendants. Opening a result and returning preserves the parent search and browsing position during the current session.
- More actions: recent updates, all content and recycle bin; upload/publish entry demonstrations appear at the list level. No actual upload, publication, restoration or deletion occurs.
- Document endpoint: clearly marked sample content, not a recreated file renderer. Live adoption must reuse the existing preview, download and permission infrastructure.

The fixture includes a nested QM → Technical → Audit path, files and notices, an empty directory, and an archived item. It is not a new production taxonomy, authorization policy or data service. Reloading retains the hash route but intentionally resets transient search/scroll state.

## Design boundary

Uses the existing shared `MobileScaffold`, `MobilePageHeader`, `MobileListItem`, `Button`, `Input`, `MobileActionSheet`, `CollectionState` and file-type icons. No new UI dependency, global color palette or app-specific stylesheet was introduced. Semantic colors and current mobile tokens are reused. The design-first skill keeps this navigation change in an integration specimen pending review; global component readiness and approval are unchanged.

Source is confined to new `mobile-intranet` specimen/model/test and route, plus the catalog link. Existing mobile work from previous turns is preserved. No new changes to the real Intranet, CMP, EMP or TMS pages are part of this prototype task.

## Verification

Commands run from the existing isolated `mobile-app-experience` worktree, with the bundled Node runtime on PATH:

- `corepack pnpm --filter @project-wing/ui-showroom exec vitest run components/showroom/specimens/mobile-intranet-model.test.ts`: **3 passed**. Covers hierarchy/deep-link validation, scoped search, archive isolation and recent ordering.
- `corepack pnpm --filter @project-wing/ui-showroom exec tsc --noEmit`: passed after fixing the effect cleanup return type.
- `corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-intranet.tsx apps/ui-showroom/components/showroom/specimens/mobile-intranet-model.ts apps/ui-showroom/components/showroom/specimens/mobile-intranet-model.test.ts apps/ui-showroom/components/showroom/specimens/mobile-material-system.tsx`: passed.
- With `NEXT_DIST_DIR=.next/intranet-prototype-build` and `NEXT_PUBLIC_API_MODE=mock`, `corepack pnpm --filter @project-wing/ui-showroom build`: passed, including the final full-width tile adjustment, 44 prerendered pages. Existing PDF-font filesystem-tracing warning and registry-script DEP0190 warning remain. Next added this output directory to generated type includes; no generated framework blocks were removed.
- `node scripts/design-first/cli.mjs validate-registry`: passed. `runAudit` scoped to the new specimen/model and catalog link: zero findings; no baseline or approval state changed.

Interactive check: headed Chrome session `intranet-prototype`, local Showroom `3047`, at 390×844 and 320×480. Exercised home → knowledge → QM → Technical → Audit → document; returned to Audit. In IT → system guides, searched Outlook, opened the file and returned with the query intact. Browser back restored the knowledge-list scroll position (80.19 CSS px before and after). Verified empty IT service directory, recycle bin, dark mode, and upload-entry explanation/dismissal. The final interaction batch reported zero console errors and exactly four home entry links. Root and content-region horizontal overflow checks were false at 320px. Initial tile layout was visually inspected and corrected using the shared Button's `fullWidth` API, not global CSS.

Inspected screenshots: `output/playwright/intranet-prototype-home.png`, `intranet-prototype-knowledge.png`, `intranet-prototype-files.png`, `intranet-prototype-dark-320.png`. Final home evidence is light mode without hover/backdrop artifacts.

Not run: full repository tests/lint, unrelated application builds, backend login/save/upload/publication, physical-device acceptance or deployment. The external EMP/CMP/TMS destinations are local preview links, not newly implemented apps. Real account/API flows and production navigation adoption remain outside this prototype; review the navigation before wiring it into Intranet.
