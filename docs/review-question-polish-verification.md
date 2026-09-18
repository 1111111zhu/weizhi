# Q send stability and blue links — 2026-09-07

## Pre-merge validation

- Fresh `git fetch origin main` confirmed the task is based on main `32ab3d6b2d28e92d640e6a025ee992ba723a4f7c` with no integration divergence.
- `corepack pnpm --filter @project-wing/emp test src/components/review-note-rich-text.test.tsx src/components/review-note-message-state.test.ts src/components/workbench-content.test.tsx -t review`: 65 passed, 134 nonmatching tests skipped.
- `corepack pnpm --filter @project-wing/emp test src/components/review-note-rich-text.test.tsx src/components/review-note-message-state.test.ts`: 14 passed (overlaps the filtered run).
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- `corepack pnpm exec ultracite check apps/emp/src/components/review-note-rich-text.tsx apps/emp/src/components/review-note-rich-text.test.tsx apps/emp/src/components/review-note-message-state.ts apps/emp/src/components/review-note-message-state.test.ts apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/workbench-review-notes-panel.tsx apps/emp/src/components/workbench-content.test.tsx`: passed, seven files.
- `git diff --check`: passed.
- `$env:NEXT_DIST_DIR='.next-pr-validation'; corepack pnpm --filter @project-wing/emp build`: passed (exit 0), including production compilation, TypeScript and all 74 static pages. Generated type references were restored to the existing dev paths; build output is not committed.

## Follow-up header polish

Further user feedback: total and unresolved badges now both use the same shared StatusBadge, `radius="full"` and `size="sm"`, so typography, padding and shape match. Only the semantic tone/status dot differs. EMP lint passed after this adjustment; local mock screenshot `output/playwright/review-q-matching-badges.png` records the result. The verified preview URL is the workbench URL in the Evidence section; open a file's notes count to see the dialog. A trial deep link using a guessed fixture question ID did not open the dialog and is not offered as a verified URL.

Separated reference code and filename with a 16px gap. Filename uses medium weight and foreground at 75% opacity; code retains full emphasis. Explicit contextCode preserves caller-owned file identity without parsing arbitrary filenames. Unresolved count reuses the shared warning-light pill with a small status dot, no orange outline; zero unresolved uses a neutral badge.

`corepack pnpm --filter @project-wing/emp lint` passed. `corepack pnpm --filter @project-wing/emp test src/components/workbench-content.test.tsx -t 'newly created Smart Form review note'` passed (1 matched). Actual local mock header inspected and captured at `output/playwright/review-q-header.png`: 16px gap, distinct label colors. No production deployment.

## Changes

- Pending messages keep their original render key when server confirmation arrives. Unrelated/stale question refetches no longer clear all pending rows. Identical replies reconcile one-to-one, excluding messages already present before send.
- Reply/reopen callers expose their mutation promise. Success incorporates the canonical question and message without changing row identity; failures remove only that pending row and restore its draft. Prevent duplicate in-flight sends. Existing image/reference and read-only mutation guards remain in place.
- Do not dim the entire pending message. Show sending state as text.
- Tiptap availability changes use `setEditable(..., false)`: toggling sending/disabled state must not emit old content and repopulate a cleared draft.
- Shared `.pw-text-link` uses deep blue in light mode and light blue in dark mode, persistent underline, and a visible focus outline. Both editor and rendered Q content use it. Existing HTTP/HTTPS validation and new-window handling remain unchanged.

## Evidence

- `corepack pnpm --filter @project-wing/emp test src/components/review-note-rich-text.test.tsx src/components/review-note-message-state.test.ts`: 14 passed, including editor availability/clear behavior, link compatibility and reconciliation edge cases.
- `corepack pnpm --filter @project-wing/emp test src/components/workbench-content.test.tsx -t 'keeps a reply row mounted'`: 1 passed; verifies actual DOM node identity through stale props, acknowledgement, canonical data and failed-send draft restoration.
- `corepack pnpm --filter @project-wing/emp test src/components/workbench-content.test.tsx -t review`: final post-editor-fix rerun passed 60 tests (125 nonmatching tests skipped), 86.35 seconds.
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- Touched seven TypeScript files passed `corepack pnpm exec ultracite check ...`; `git diff --check` passed. Registry structural validation passed. Scoped design-boundary audit still reports the unchanged pre-existing `placeholder="https://"` in the link-address field as static copy. No audit baseline or permission exceptions were changed.

Real browser, local **mock** EMP at http://127.0.0.1:3040/zh-CN/engagement/project-orchid-2026 → file review notes → insert named HTTPS link → Send. An independent Playwright CLI browser was used after the in-app browser tool could not initialize its kernel assets. First navigation timed out during initial Next compilation; subsequent navigation succeeded. One unrelated console failure is the absent mock Desktop Agent download API at localhost:3999.

Final observed result: dialogStable=true, composerStable=true, removedMessageOrDialogNodes=0, messageCount=1, messageOpacity=1, composerText empty. Editor and sent link both computed rgb(15,108,189) with underline. Dark/narrow check computed rgb(143,199,255) with underline, dialog width720.37 within viewport760. Preview theme and viewport were restored afterward.

Artifacts (not production data): `output/playwright/review-q-light.png`, `review-q-dark-narrow.png`, and reproducible CLI snippets `verify-q-send.js` / `verify-q-dark.js`. Screenshots were inspected. Earlier screenshot revealed the stale draft write-back; final light capture confirms the editor stays empty after success.

Not run during implementation: production-backed Q submission (would send messages in a real project), full monorepo tests, production build, automated full visual regression. No production Q, reply, invitation, email or file mutation. Delivery is tracked separately from these local checks; local mock acceptance is not production-backed acceptance.
