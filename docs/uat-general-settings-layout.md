# General settings layout

Applied the personalization page's spacing and alignment to General: a matching max-width, left-aligned labels, a consistent right-hand control column and subtle row separators. Display language and framework are now plain read-only text instead of disabled-looking boxes. Framework text can wrap. Each row stacks label over value when the settings container is narrow. Existing editing, permission checks, confirm/cancel controls, date pickers and save behavior are unchanged.

## Verification

- `corepack pnpm --filter @project-wing/emp exec vitest run src/views/workbench-settings-panel.test.tsx`: 26 passed.
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- `oxfmt apps/emp/src/views/workbench-settings-panel.tsx --check --config oxfmt.config.ts`: passed with Node 24.
- `git diff --check`: passed.
- Real local mock app: `http://127.0.0.1:3033/zh-CN/engagement/project-orchid-2026`, Settings → General. Inspected a dark-mode screenshot: all six labels and value columns align, and read-only rows have no input chrome. At a 427px content region (395px row width), all six rows used one column and the region had no horizontal overflow. Restored the browser viewport afterwards.

This was a visual change tested with mock project data. No live save, repository-wide test suite or deployment was run.
