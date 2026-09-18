# EMP mobile navigation: actual application integration

2026-09-12. Worktree: `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`.

## Authoritative entry

Use **`http://127.0.0.1:3048/zh-CN/engagement`**. This change is in the actual EMP React application, not `3047/specimens/MobileWorkspace`. The local preview uses the existing Mock API mode; it is not a production deployment or real-backend acceptance.

The user explicitly requested folder-first navigation and collapsed actions, then directed us to stop maintaining an independent mobile business prototype. No new Showroom business route, fixture data source, Flutter/Dart runtime or dependency was introduced in this integration. Existing prototype files were not deleted because they contain other not-yet-integrated work; they are not the acceptance surface and are not being synchronized as a second app.

## Changes

- Phone project entry shows folders. Only entering a folder reveals its projects. The existing `folderId` and `returnTo` route parameters and project-open callback remain in use.
- Project entry defaults to directory browsing on phones. Existing file/question deep links retain their direct-entry behavior. Directory browsing shows one level at a time; the header back action walks back through the directory trail, file list and project list.
- The phone header shows back, current title and a More button. Search is opt-in. Existing top-bar actions and account controls are reachable from the shared bottom action sheet.
- The real file index now has a phone list projection. File name is primary, reference is secondary, and existing status/note/signoff cell renderers are reused. The initial 40 rows are progressively expanded using Show more; highlighted targets are included. Desktop table/virtualization remains unchanged.
- List controls (upload, buckets, column settings and sort/filter menus) live in a bottom sheet. Existing per-file context actions and blank-space creation/upload/paste actions are still reachable, using the original callbacks and guards.
- Folder rename/delete reuse protected-folder, non-empty-folder and pending guards. Project editing/opening and moving between folders reuse existing handlers. Directory management uses the canonical directory editor, exposed from More.
- Folder/project list scroll offsets are stored as optional per-view session UI preferences. Directory/preview panes retain existing state ownership. No API, permission, audit or persisted business schema was changed.

The design-first skill was used to keep the new app-specific compositions built from shared mobile primitives and existing Material tokens. The added EMP stylesheet is scoped below 48rem; phone runtime branches use the existing 767px compact hook. No global desktop visual migration is authorized or claimed.

## Validation and limitations

This integration is not a claim that all old prototypes or every mobile application flow has been migrated. Existing file action menus and directory administration remain canonical; this pass changes their entry points, not their complete internal interaction design.

Commands run with the bundled Node runtime on PATH:

- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/emp-mobile-navigation.test.tsx src/components/project-page-header.test.tsx src/components/project-wing-top-bar-controls.test.tsx src/components/workbench-content.test.tsx --maxWorkers=1`: **226 passed**.
- `corepack pnpm --filter @project-wing/emp exec vitest run src/views/projects.test.tsx src/views/workspace.test.tsx --maxWorkers=1`: **142 passed**.
- `corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-color-palette.test.ts --maxWorkers=1`: **9 passed**, including the new EMP mobile-only stylesheet scope. These three runs cover 377 tests.
- After finding and repairing the mobile notes-dialog remount problem: `corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'uses the mobile file list' --maxWorkers=1`: **1 passed**, other 186 tests deliberately not selected. The regression now opens notes after interacting with the list controls.
- After the focus-handoff adjustment: `corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-page-header.test.tsx src/components/emp-mobile-navigation.test.tsx --maxWorkers=1`: **26 passed**.
- `corepack pnpm --filter @project-wing/emp exec tsc --noEmit`: passed; final production build also includes TypeScript checking.
- `corepack pnpm exec ultracite check apps/emp/src/views/projects.tsx apps/emp/src/views/workspace.tsx apps/emp/src/components/project-page-header.tsx apps/emp/src/components/project-wing-top-bar-controls.tsx apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/workbench-content.test.tsx apps/emp/src/components/emp-mobile-projects.tsx apps/emp/src/components/emp-mobile-directory.tsx apps/emp/src/components/emp-mobile-navigation.test.tsx apps/emp/src/i18n/mobile-navigation.ts`: passed, with follow-up checks on the last focus/selection changes.
- With `NEXT_DIST_DIR=.next/emp-mobile-navigation-build`, `NEXT_PUBLIC_API_MODE=mock`, `corepack pnpm --filter @project-wing/emp build`: passed, including the final selection header and focus changes (77 prerendered pages).
- `node scripts/design-first/cli.mjs validate-registry`: passed. Scoped `runAudit` was **not fully green**: it reports one native template-code `<button>` in `apps/emp/src/views/projects.tsx` (reported at line 6251 at the time of the audit). `git show HEAD:apps/emp/src/views/projects.tsx` confirms this exact control already exists in HEAD. It was not changed because it belongs to desktop template editing, outside this phone-only task. No baseline was relaxed.

Parallel test attempts hit memory pressure (under 1 GB free) and timing failures; they were stopped and rerun serially. Only the completed passing runs above count as evidence. Initial selector/format errors were corrected, not ignored. Full root lint/tests and unrelated application builds were not rerun.

### Actual application walkthrough

Headed Chrome, local Mock EMP at **3048**, 390px and 320px:

- Entered the actual default folder, then the actual Orchid project. Browsed Planning → Client acceptance or continuance → A1-1000.
- Opened the file context menu and verified preview, export, multi-select, reference editing, rename, version history, move, copy/cut/paste and delete entries. No destructive command was executed.
- Opened the list-action sheet: upload, current/prior/temporary buckets, creation/paste entry and column sort/filter controls were present. Sheet `scrollWidth` and `clientWidth` were both 390px.
- Found and fixed a real notes-open regression: using column callbacks as React component types remounted the notes cell. Mobile now uses the same direct callback rendering as desktop. The actual notes dialog opened afterward and fit inside the viewport (about 350px wide at 390px).
- Opened a PDF preview and returned through the header to the file list. The preview header used the filename. This validates navigation, not every file format or backend binary.
- 320px file-list root overflow check passed. At 1440px, the original table returned, no mobile file list was mounted, and the mobile Material token was absent.
- Entered multi-select from the existing file menu, used the phone select-all control (`选择全部项目文件`), and observed all 40 rendered rows selected. No export or deletion followed. Search showed the filtered empty state and clearing it restored the actual folder. Light and dark phone views were inspected.

Screenshots inspected under `output/playwright/`: `emp-live-folders.png`, `emp-live-projects.png`, `emp-live-directories.png`, `emp-live-files.png`, `emp-live-file-tools.png`, `emp-live-notes.png`, `emp-live-files-320.png`, `emp-live-desktop.png`.

The local EMP service had stopped between sessions; it was restarted on the same port with `NEXT_PUBLIC_API_MODE=mock`, `NEXT_DIST_DIR=.next`, using `corepack pnpm --filter @project-wing/emp exec next dev -H 127.0.0.1 -p 3048` in this worktree. `adb devices -l` returned no connected emulator, so fresh Android hardware-back, keyboard and physical-device acceptance are **not claimed**. Header back navigation is implemented; browser/system-back behavior within one project still needs dedicated acceptance. No push, merge, deployment or real business mutation was performed for verification.

The first browser checks identified the same pre-existing unavailable local Desktop Agent manifest endpoint (`localhost:3000/downloads/desktop-agent/windows/manifest`). No fake response was added or errors suppressed. Real uploads, actual signatures, destructive actions and backend persistence are not performed merely for UI verification.
