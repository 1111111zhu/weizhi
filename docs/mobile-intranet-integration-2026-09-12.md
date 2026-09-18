# Mobile Intranet integration — 2026-09-12

## Scope and design decision

Implemented in `apps/intranet`, on `codex/mobile-app-experience`. The actual Intranet homepage now presents EMP, CMP, TMS and Knowledge Center as four application entries below 768 CSS pixels. Knowledge navigation progresses from department to secondary category to tertiary category and content. The existing catalog is the source of hierarchy, not a parallel hard-coded mobile catalog.

This is the user's approved application-specific navigation change. Following the design-first admission test, it composes the existing public Button styling, MobileActionSheet, CollectionState and top-bar APIs with existing Material 3 tokens. No new component library, global theme, or standalone prototype was introduced. The existing desktop composition remains in `page-client.tsx`.

The four entries share one internal layout, title line-height and description weight. The Knowledge Center button previously inherited a different line-height from the three native links; both its wrapper and typography are now aligned. Subsystem entries remain native links, with proper link semantics.

At the user's follow-up request, Recent updates and All content use two compact outlined Material-style surfaces, with semantic backgrounds, subtle borders and the existing button state layer. Mobile page and header share the same fractional-width breakpoint to avoid a desktop fallback just below 768px when the browser is zoomed.

## Behavior retained

- Existing settings/account menus, locale and appearance controls.
- Current permissions, preview/download URLs, publish/manage dialogs and archive loading/error/retry behavior. Publishing and recycle controls move into the Knowledge Center's More sheet, not onto the workspace homepage.
- Unfiled content remains reachable through View all content at each branch.
- Browser Back and hash deep links preserve directory navigation. Refresh restores the directory; in-session back navigation restores search, scroll and loaded item count.
- Recent notices appear on the workspace only when supplied published data exists. No fabricated activity or large homepage empty state.
- Development service URLs are configurable. The machine-local `.env.development.local` is ignored; deployment defaults are unchanged.

## Automated validation

Run from `D:\Project_wing\.worktrees\mobile-app-experience` with Node 24.19.0:

```powershell
corepack pnpm --filter @project-wing/intranet exec vitest run --maxWorkers=1
corepack pnpm --filter @project-wing/intranet exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
```

Results: **67 tests passed in 12 files**; type checking and registry validation passed. This includes the existing desktop page tests and the new hierarchy, permissions, archive retry, notice and native-link tests.

Scoped lint command (passed, 13 touched files):

```powershell
corepack pnpm exec ultracite check apps/intranet/src/components/mobile-intranet.tsx apps/intranet/src/components/mobile-intranet.module.css apps/intranet/src/components/mobile-intranet.test.tsx apps/intranet/src/components/intranet-top-bar.tsx apps/intranet/src/components/knowledge-notice-preview.tsx apps/intranet/src/app/page-client.tsx apps/intranet/src/i18n/dictionaries.ts apps/intranet/src/lib/mobile-navigation.ts apps/intranet/src/lib/mobile-navigation.test.ts apps/intranet/src/lib/system-links.ts apps/intranet/src/lib/system-links.test.ts apps/intranet/next.config.ts 'apps/intranet/src/app/[locale]/page.tsx'
```

Production compilation of the local Mock configuration (passed, 14 generated pages; separate output keeps the active dev server available):

```powershell
$env:NEXT_DIST_DIR = '.next/intranet-mobile-portal-build'
$env:NEXT_PUBLIC_API_MODE = 'mock'
corepack pnpm --filter @project-wing/intranet build
```

## Interactive evidence

Actual running application, not port 3047's showroom:

- Desktop browser: `http://127.0.0.1:3057/zh-CN`.
- Android emulator Chrome: `http://10.0.2.2:3057/zh-CN`.
- Playwright CLI headed session: `intranet-live-mobile`.
- Local Mock mode; the existing Mock identity route provided the browser's development account. The emulator retained its existing account.

Exercised workspace → Knowledge Center → QM → Technical → Audit; refreshed the leaf route and returned to Technical. Opened More → Upload to verify the existing form opens as a single dialog, then cancelled without publishing. Checked mobile light/dark appearance and desktop navigation. Captured and inspected the current Android workspace and Knowledge Center.

Visual artifacts, relative to the worktree:

- `output/playwright/intranet-home-integrated.png`
- `output/playwright/intranet-home-320.png`
- `output/playwright/intranet-home-dark.png`
- `output/playwright/intranet-desktop-preserved.png`
- `output/playwright/intranet-knowledge-departments.png`
- `output/playwright/intranet-knowledge-subfolders.png`
- `output/playwright/intranet-knowledge-actions.png`
- `output/playwright/intranet-knowledge-outlined-actions.png`
- `output/playwright/intranet-emulator-aligned.png`

## Limits / manual acceptance still required

This is local Mock acceptance, not backend-attached acceptance or deployment. The local knowledge dataset is empty; populated data and notice behavior have automated coverage, but real upload, publish, download, restore and permission workflows still need backend-attached verification. Existing unavailable local backend requests (Desktop Agent manifest / TMS approval state) continue to log connection errors; this report does not claim a clean console.

CMP and TMS destinations are configured but their services/pages were not exercised. No root-wide test/lint run, remote deployment, push or merge was performed. Existing unrelated worktree changes were preserved.
