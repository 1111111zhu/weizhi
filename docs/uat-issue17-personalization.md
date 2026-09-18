# Issue 17: personalization and theme preview cards

The user requested a Codex-like visual theme selector. Added the shared controlled `ThemePreferenceCards` component in `packages/ui`, using native radio inputs with visible selection/focus states. The system option has a split preview; light and dark options have miniature application layouts. Miniatures use fixed neutral illustration colors while selection uses the existing semantic primary/ring tokens.

EMP personalization now places the theme cards first, followed by aligned language, font size and browser PDF reader rows with subtle dividers. Chinese labels use 主题 / 系统 / 浅色 / 深色. Existing theme persistence, system-theme behavior, locale navigation and PDF viewer preferences are retained.

Design-first guided the shared component placement, public export, experimental registry entry and showroom specimen, without changing the project's global palette.

## Validation

- `corepack pnpm --filter @project-wing/emp exec vitest run src/views/workbench-settings-panel.test.tsx`: 26 passed, including theme selection and browser PDF preference.
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- `corepack pnpm --filter @project-wing/ui lint`: passed.
- `corepack pnpm --filter @project-wing/ui-showroom typecheck`: passed with the running development server's generated types.
- `node scripts/design-first/cli.mjs validate-registry`: passed using Node 24.
- `node scripts/ui-stack-guardrails.mjs`: failed with 104 unexpected findings across the workspace. Baselines were not changed. This is not a clean global design-boundary validation.
- Oxfmt formatted the touched files and `git diff --check` passed. Next's generated next-env route-import changes from starting the showroom were restored to their previous paths.

Browser environment: `http://127.0.0.1:3033/zh-CN/engagement/project-orchid-2026` (mock). Path: Settings → Personalization. Captured light/dark screenshots, used ArrowLeft to move from Dark to Light, and verified the root dark class was removed. Measured a narrow 395px card group with matching scroll width (no overflow). Temporary viewport override reset.

Showroom: `http://127.0.0.1:3034/specimens/Settings#theme-preferences`. Verified the actual shared cards, keyboard selection from System to Light, and disabled options. Component remains experimental, not declared globally Ready/Approved.

No live backend mutation, full build, repository-wide test suite, push, merge or deployment was performed for Issue 17.
