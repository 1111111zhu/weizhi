# Enterprise UI color consolidation — 2026-09-05

Implemented locally in `.worktrees/saas-ui-consistency-pass` under the user's explicit color-optimization request. Previous UI-pass changes are preserved. No PR, merge, deployment or business-record mutation was performed.

## Scope and decisions

- Shared `color-palette.css` is the light/dark source of truth. EMP, CMP, TMS and Intranet global roles now reference it instead of independent green, emerald, violet, yellow and slate values.
- Light mode: green `#007a3d` primary actions, near-neutral `#f5f7f8` canvas, white work surface and readable `#526174` supporting text. Dark mode uses charcoal surfaces with mint primary actions and dark text on filled status colors.
- Status roles distinguish filled background/foreground from subtle background/text. Existing Badge variant names remain compatible; quiet and outlined badges no longer reuse white text intended for solid fills. Applicable legacy EMP wrappers and inline warning/error copy use the corrected text roles.
- CMP informational statuses move from violet to restrained blue; success is deep green, attention is amber, failure is red. These colors continue to accompany text/icons, not replace meaning.
- Confirmation matrix zero counts are neutral; low/medium cells use readable colored text and high-intensity cells retain solid status fills. Confirmation-center count links now use semantic colors rather than emerald utilities.
- Removed authentication's unrelated orange primary override. File-format colors, avatar identity colors, document content, explicit editor palettes and category-series colors were not indiscriminately recolored.
- Shared foundations and actual Badge/Button/Input examples are linked from `/foundations` to `/specimens/Color`. Registry status is experimental, not a whole-system approval or accessibility certification.

## Accessibility evidence

The target uses [W3C text contrast guidance](https://www.w3.org/WAI/WCAG21/Techniques/general/G18.html): 4.5:1 for ordinary text. Identifying input/focus color pairs are tested at 3:1. Tests read the actual CSS palette rather than copied fixture colors and check that app-level global roles continue to alias the shared palette.

The browser measured 23 opaque Badge foreground/background pairs, including light/dark filled and subtle states. Minimum measured contrast was **5.81:1**, with none below 4.5:1. Translucent outline combinations were excluded from that simple browser metric; core palette pair tests cover their text roles. This is not an exhaustive WCAG audit of every application element, opacity combination, authored document or viewport.

## Interactive review

Used computer-use browser controls against backend-attached local development apps. Existing development sign-in was retained; no account, approval, upload or timesheet submission action was performed.

- EMP: `http://localhost:3001/zh-CN/admin/users` and the already-open confirmation center. Inspected statuses, muted copy, search/role controls and primary actions.
- CMP: `http://localhost:3002/zh-CN/clients`, using the repository API proxy on 3012. Inspected real client rows and active/inactive badges.
- TMS: `http://localhost:3004/zh-CN/timesheet`, proxy on 3013. Inspected the signed-in account's empty period, work surfaces, filters and progress/status treatment; populated approval-row flow was not exercised live.
- Intranet: `http://localhost:3007/zh-CN`. Inspected actual notice rows, navigation and avatar preservation. Computed primary/background/muted-text values matched the canonical palette.
- Shared specimen: `http://localhost:3008/specimens/Color`. Inspected both themes, semantic variants, disabled buttons, selected surface and focused dark input. Screenshots were captured inline in this task for the specimen and all four apps.

## Commands and current results

Commands below ran from the worktree with bundled Node 24.19 and pnpm 11.19. No root-wide test command was run.

| Command | Result |
| --- | --- |
| `pnpm --filter @project-wing/ui test` | Final **125 tests passed**, 18 files; includes **51** color, contrast, Badge-role and app-alias checks |
| `pnpm --filter @project-wing/emp exec vitest run src/views/admin-users.test.tsx src/components/confirmations/confirmation-overview-matrix.test.tsx` | **14 passed** |
| `pnpm --filter @project-wing/emp exec vitest run src/views/confirmations.test.tsx` | **11 passed** |
| `pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-acceptance-view.test.tsx 'src/app/[locale]/clients/page-client.test.tsx'` | **56 passed, 2 failed**. Acceptance suite passed; client-form failures expect 3 accordion items where 4 render, and a `4. Preview` tab that does not exist in the current step structure |
| `pnpm --filter @project-wing/cmp exec vitest run 'src/app/[locale]/clients/page-client.test.tsx' -t 'opens a searchable Manager'` | The missing-preview-tab failure reproduced in isolation; 5 nonmatching tests skipped |
| `pnpm --filter @project-wing/tms exec vitest run src/components/approval-workspace.test.tsx` | **59 passed, 1 failed**: expects `待审 1`, absent from current rendered project rail |
| `pnpm --filter @project-wing/tms exec vitest run src/components/approval-workspace.test.tsx -t 'refreshes the project pending count'` | Same missing-label failure reproduced in isolation; 59 nonmatching tests skipped |
| `pnpm --filter @project-wing/ui --filter @project-wing/emp --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ui-showroom lint` | All **six** workspace checks passed; CMP also builds shared contracts |
| `pnpm --filter @project-wing/emp build` | Passed |
| `pnpm --filter @project-wing/cmp build` | Passed |
| `pnpm --filter @project-wing/tms build` | Passed |
| `pnpm --filter @project-wing/intranet build` | Passed |
| `pnpm --filter @project-wing/ui-showroom build` | Passed; existing PDF-font dynamic-filesystem tracing warning remains |
| `node scripts/design-first/cli.mjs validate-registry` | Passed |
| `node scripts/design-first/cli.mjs audit --json` | Not clean: **103** unexpected findings, unchanged from the preceding UI pass; baseline allowances were not expanded |
| `git diff --check` | Passed |

The three failing regression assertions concern untouched workflow structure/copy, not the updated color-class assertions. They were not weakened or repaired by changing approval behavior. No pristine-baseline execution was performed, so this report does not claim a fully green regression suite or verified merge readiness.

The CSS-reading test initially needed Node type declarations; `@types/node` was added as a UI development dependency using the already-locked 24.12.4 resolution. `pnpm install --filter @project-wing/ui --offline --ignore-scripts` initially failed on unrelated missing offline metadata. After pinning the existing resolution in the importer, `pnpm install --filter @project-wing/ui --offline --ignore-scripts --frozen-lockfile` passed. No runtime dependency or application data migration was introduced. Build-generated next-env paths and registry line-ending-only changes were restored.
