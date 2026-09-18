# Mobile SmartForm performance — 2026-09-11

Scope: the shared EMP SmartForm V2 entry/readonly rendering pipeline. No visual tokens, desktop styling, routing, API contracts, persistence timing or validation rules were changed. This is a local performance improvement, not a production-readiness or whole-product performance certification.

## Changes

- Mount the active sheet projection only. Phone record layouts no longer also mount CSS-hidden desktop tables, editors and subscriptions. Wide layouts retain their original tables without hidden mobile records. Explicit comparison/scroll tables remain available on phones.
- Keep both CSS-responsive projections in component server markup until hydration knows the viewport. The viewport store distinguishes "unknown on the server" from desktop; only the redundant client tree is removed. This preserves the component's existing server content; it does not remove outer route-level Suspense gating.
- Cache schema-derived row/column projections and per-sheet answer lookup by their actual inputs.
- Cache saved/draft fingerprints independently, preserving content-based dirty detection, including undo back to the saved content.
- Memoize static localized content and unchanged field-value rendering using normal React prop comparisons. Answer/context changes still update; validation and draft propagation remain immediate.

## Measurement method

Headed Chrome controlled through Playwright CLI, local **production** builds, English deferred-income fixture, 390 × 844 viewport, Chrome CPU throttle 4×. Baseline: `3068`, `.next/material-mobile-build`; optimized: `3069`, `.next/mobile-perf-build`. Each batch reloads the fixture three times, opens the first Comments bottom sheet, warms the editor, then enters 24 characters. No real backend writes occur.

The script measures **keydown handler entry to two animation-frame callbacks**, not INP, OS keyboard latency or guaranteed paint completion. Long tasks come from PerformanceObserver; background mutations count child/text changes in the document behind the portaled editor. CPU throttling is not a substitute for physical low-end phones. No build/test jobs run during measurement batches.

First batch results:

| Metric | Baseline, runs 1 / 2 / 3 | Optimized, runs 1 / 2 / 3 |
| --- | --- | --- |
| Document DOM nodes | 1869 / 1869 / 1869 | 1104 / 1104 / 1104 |
| Hidden desktop tables | 4 / 4 / 4 | 0 / 0 / 0 |
| Two-frame probe p50 (ms) | 106.9 / 75.1 / 77.7 | 51.8 / 42.3 / 42.8 |
| Two-frame probe p95 (ms) | 310.4 / 155.8 / 148.1 | 113.3 / 92.5 / 90.0 |
| Long tasks per 24 keys | 26 / 25 / 23 | 5 / 0 / 0 |
| Total long-task duration (ms) | 2699 / 1640 / 1448 | 364 / 0 / 0 |
| Background DOM mutations | 48 / 48 / 48 | 24 / 24 / 24 |

The stable structural reduction is 765 nodes (40.9%); background text updates halve because the duplicate projection no longer exists. Timing is environment-dependent.

Alternating baseline → optimized repeat, with the same measurement body:

| Metric | Baseline, runs 4 / 5 / 6 | Optimized, runs 4 / 5 / 6 |
| --- | --- | --- |
| Two-frame probe p50 (ms) | 64.8 / 65.5 / 64.0 | 49.3 / 50.7 / 45.1 |
| Two-frame probe p95 (ms) | 116.9 / 128.5 / 119.9 | 100.9 / 95.1 / 101.6 |
| Long tasks per 24 keys | 13 / 18 / 19 | 5 / 3 / 0 |
| Total long-task duration (ms) | 728 / 1018 / 1111 | 267 / 156 / 0 |

DOM counts and background mutations were unchanged from the first batch. Across six runs per build, the median of per-run p50 values was **70.3 → 47.2 ms** (32.9% lower); the median of per-run p95 values was **138.3 → 98.0 ms** (29.1% lower). Total long-task counts were **124 → 13** across 144 measured keystrokes per build. These are not pooled percentiles or whole-app speedups. Warm-up variation is visible, so both batches are retained rather than reporting only the fastest run.

Final hydration-preserving artifact (`3070`) follow-up, using the same probe: DOM **1104**, tables **0**, background mutations **24** in all three runs; p50 **45.1 / 44.1 / 43.8 ms**, p95 **73.9 / 82.3 / 90.7 ms**, long tasks **3 / 0 / 1** (total durations **165 / 0 / 53 ms**). This confirms the first-paint safeguard retained the interactive optimization; these extra runs are reported separately from the alternating comparison above.

### Reproduction

Use an isolated fixture tab with no valuable unsaved data. The benchmark reloads it. The file is a function consumed by Playwright CLI's function-expression loader:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=perf-mobile run-code --filename scripts/perf/mobile-smartform-benchmark.mjs
```

The final source uses a named function instead of the original arrow expression so module formatting does not append a semicolon that this loader rejects. The measurement operations were not changed. Passing the entire formatted source on the Windows command line exceeded its length limit, and dynamic imports are unavailable in the CLI VM; use the file invocation above.

## Verification

Commands, using the bundled Node runtime on PATH:

- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-editor.test.tsx src/components/smart-form-v2-readonly.test.tsx src/components/smart-form-v2-preview.test.tsx src/components/smart-form-v2-rich-text-identity.test.ts src/components/smart-form-v2-mobile-records.test.tsx --maxWorkers=2`: **40 passed** in the final run. Includes data retention while switching desktop/mobile projections, original sheet/row/column save identity, grouped labels/visibility, explicit comparison-table fallback, desktop collapse/expand, and both editor/readonly server-markup readability.
- `corepack pnpm --filter @project-wing/emp exec tsc --noEmit`: passed.
- `corepack pnpm exec ultracite check apps/emp/src/components/smart-form-v2-expansion.tsx apps/emp/src/components/smart-form-v2-editor.tsx apps/emp/src/components/smart-form-v2-readonly.tsx apps/emp/src/components/smart-form-v2-editor.test.tsx apps/emp/src/components/smart-form-v2-readonly.test.tsx apps/emp/src/components/smart-form-v2-mobile-records.test.tsx scripts/perf/mobile-smartform-benchmark.mjs`: passed.
- With `NEXT_DIST_DIR=.next/mobile-perf-build`, `NEXT_PUBLIC_API_MODE=mock`: `corepack pnpm --filter @project-wing/emp build`: passed (77 prerendered pages, TypeScript included).
- Repeated the same build command with `NEXT_DIST_DIR=.next/mobile-perf-final-build` after the hydration fallback: passed. The final artifact is served at `3070` without overwriting either measured comparison build.
- `playwright-cli -s=perf-mobile console error`: zero errors/warnings in the checked production fixture flow.

Interactive environment: `http://127.0.0.1:3069/en-US/dev/smart-form-v2/deferred-income`, production-built mock fixture. Opened Comments, entered text, closed it, switched Read only → Fill, and reopened the editor: the unsaved text remained. Resized to 1440px: four original tables, zero hidden mobile records. Returned to 320px: the text remained and there was no root horizontal overflow. Inspected both light and manually applied existing dark theme. Screenshots: `docs/evidence/mobile-app-experience/perf-mobile-richtext.png`, `perf-desktop.png`, `perf-mobile-dark.png`. An initial screenshot captured an unfinished transition; it was replaced with a settled-animation capture.

Final no-JavaScript check: independent Chrome context, 390px, `javaScriptEnabled:false`. Both baseline `3068` and final `3070` displayed only the route's existing Suspense skeleton (zero record nodes and no body text). The initial attempt to read a record timed out; comparing both builds established that it was not newly introduced. See `perf-no-js-3068.png` and `perf-no-js-3070.png`. **Full-page pre-JavaScript content/first-load performance is not fixed or certified here**; only component SSR markup is protected by the new tests. The final `3070` interactive benchmark did successfully open/type/close the real editor after hydration.

The final artifact's settled editor was also inspected in `perf-final-mobile.png`; its browser console reported zero errors/warnings. Temporary comparison servers `3068` and `3069` were stopped after testing. Final preview `3070` remains available; existing development servers were left untouched.

Initial test attempts surfaced stale selectors relying on CSS-hidden mobile DOM and an over-broad row selector shared by two different sheets. Tests now explicitly model the intended viewport and original sheet identity; the functional assertions remain. Initial scoped lint errors were fixed before the passing check.

Not run this turn: repository-wide lint/tests, unrelated application builds, physical-device/IME latency, real authenticated API save/retry, network/load testing. Earlier repository-wide lint/test failures and backend/device release gates remain tracked in `mobile-production-readiness.md`; this task does not resolve or relabel them. No deployment or remote mutation was performed.
