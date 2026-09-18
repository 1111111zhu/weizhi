# Mobile workspace refinements — delivery evidence

This is the consolidated delivery record for the 2026-09-14/15 walkthrough. Earlier entries in `mobile-walkthrough-2026-09-14.md` are chronological observations, not the final acceptance status.

## Scope

- EMP: compact file-manager rows; neutral P/R signer groups; occupancy icon and sheet using actual lock holder; filename/reference search; mobile file action sheets; searchable note list and segmented statuses; discussion tools/status sheets; single-surface composer with explicit formatting. Desktop behaviors retained.
- CMP: dashboard entry follows SUPER_ADMIN access; readable localized mobile billing overview.
- TMS: complete period/date labels, stable evidence header and consistent mobile action targets.
- Intranet: approved editorial launcher, locally served licensed Noto Serif subset, real notice preview trigger with actual update date. No hard-coded sample notifications.
- No API, persistence/schema, auth policy or deployment configuration changes. `.next-walkthrough/` ignores isolated local build output.

## Interactive evidence

Actual running EMP Mock app at localhost:3001, project-orchid-2026 → Planning → A1 → A1-1000; Intranet Mock at localhost:3007/zh-CN. EMP checked at 320/360/390/430 where applicable; Intranet at 320/390/430. Tests cover file/name/ref search, note status/search, detail/back/draft retention, explicit formatting, reference/status sheets, file actions, compact touch geometry and no page overflow. Isolated synthetic occupancy records used only in test-browser Mock storage. No production business mutations submitted.

Screenshots copied from the inspected running application:

- [File list](review-assets/mobile-2026-09-15/file-list.png)
- [File actions](review-assets/mobile-2026-09-15/file-actions.png)
- [Review notes](review-assets/mobile-2026-09-15/review-notes.png)
- [Reply composer](review-assets/mobile-2026-09-15/note-composer.png)
- [Intranet home](review-assets/mobile-2026-09-15/intranet-home.png)

## Limits of this evidence

Local Mock UI verification is not backend-attached acceptance. Live lock persistence, real signoff uploads, Android soft-keyboard behavior and actual notice data are not claimed as verified. Local approval/logistics requests to unavailable localhost:3000 remain unrelated errors; populated notice presentation has component-test evidence. Earlier CMP/TMS checks and builds are documented in the walkthrough; deployment screenshots are not proof of newer local refinements. No host activation or deployment success is implied by a PR merge or successful build.

The delivery-turn EMP browser rerun after synchronizing main timed out twice, and a local HTTP read also timed out. Those reruns are not passing evidence; the included screenshots are the earlier successful feature-level checks. The user-owned dev server was not stopped to force a fresh result.

## Pre-merge review and validation

- Independent read-only review found no actionable functional regression or permission bypass in the task diff, conditional on current validation and baseline reconciliation.
- Fetched main `00423eddac3545f45928587cb77cccde437dd729` and fast-forwarded with Git autostash; task changes reapplied without conflicts. New multi-lead/project-creation and splitter changes retained. No blanket conflict resolution.
- Before reconciliation, fresh targeted validation passed 344 tests: EMP `workbench-content.test.tsx` + `workspace.test.tsx` (276); CMP app-shell + billing tests (30); TMS mobile tests (9); Intranet mobile/page-client/styles tests (29). Each used `corepack pnpm --filter <workspace> exec vitest run <files> --maxWorkers=1`.
- Full selected-workspace hook validation and build results are recorded in PR delivery comments. A successful local commit does not imply deployment completion.
- Main introduced two fixed inline styles in `new-project.tsx` rejected by the existing UI guard. They were replaced with equivalent sizing utilities; the file also received required formatting and equivalent ternary/Fragment cleanup. Independent review confirmed no business logic change. No guard baseline was expanded.
- After main reconciliation, shared package and all four frontend production builds passed using isolated `.next-walkthrough` output and Mock configuration. This is a local compilation check, not a production image/deployment claim.
