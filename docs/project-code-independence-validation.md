# Independent EMP project codes

Date: 2026-09-09. Branch: `codex/project-code-independence`.

## Behavior

- `Project.projectCode` is independent of CMP `engagementCode`; the existing internal `projectNumber` is unchanged.
- Quick, CMP-linked, template and roll-forward creation accept a trimmed manual code. Blank uses the existing automatic code format.
- Linking/unlinking CMP no longer renumbers a project. Membership, authorization and TMS reconciliation remain in place.
- Duplicate manual codes, including archived codes, are rejected rather than renumbering another project or silently adding a suffix.
- Project selectors and the project-code column use the project's own code. Older home display preferences receive a one-time project-code-column visibility migration; other preferences are retained, and subsequent explicit hiding is honored.
- Existing codes are not bulk rewritten. No schema migration is required.
- Existing GuidedForm/table primitives were reused under design-first guidance. Per user feedback, the code field has no explanatory paragraph; only the optional automatic-generation placeholder remains.

## Commands and results

Run from the isolated worktree with the bundled Node 24 runtime on PATH:

```powershell
corepack pnpm install --filter @project-wing/emp... --filter @project-wing/api... --frozen-lockfile --ignore-scripts
corepack pnpm --filter @project-wing/api exec prisma generate
corepack pnpm --filter @project-wing/shared build
corepack pnpm --filter @project-wing/api test src/projects/projects.service.spec.ts src/projects/projects.controller.spec.ts
corepack pnpm --filter @project-wing/emp test src/views/new-project.test.tsx src/views/projects.test.tsx src/components/project-page-header.test.tsx src/api/mock-api.test.ts
corepack pnpm --filter @project-wing/emp test src/views/projects.test.tsx src/components/project-page-header.test.tsx -t 'project code|own code'
corepack pnpm --filter @project-wing/emp test src/views/new-project.test.tsx
corepack pnpm --filter @project-wing/emp lint
corepack pnpm --filter @project-wing/api lint
$projectCodeChangedFiles = git diff --name-only
corepack pnpm exec oxfmt --config oxfmt.config.ts $projectCodeChangedFiles
corepack pnpm exec ultracite check $projectCodeChangedFiles
git diff --check
```

Install, Prisma generation and shared build passed. Prisma generation used a dummy URL, not a database mutation. API: 90 passed. EMP combined: 176 passed. After hook-order cleanup: 3 targeted tests passed (93 excluded). After the final helper-copy removal: 18 wizard tests passed. Both typechecks, changed-source formatting/static checks and whitespace checks passed. An initial EMP typecheck before shared build completion failed on missing built shared exports; the subsequent checks passed.

## Browser acceptance and limitations

Pre-merge follow-up: `node scripts/repository-policy-guardrails.mjs` passed (no staged files at that invocation). `node scripts/volatile-test-assertions.mjs` initially reported 73 findings; three newly added DOM-absence assertions were changed to equivalent `not.toBeInTheDocument()` matchers without weakening their meaning. The final scan reports 70 existing findings. Comparing their fingerprints against `origin/main` found zero new findings; this is not a claim that the repository-wide guard passes. The two affected home-preference tests were rerun and passed. Changed-test `ultracite check` passed.

Playwright CLI session `project-code`, real Edge browser, actual EMP application at `http://127.0.0.1:3043`, `NEXT_PUBLIC_API_MODE=mock`. No production records were changed.

Interactive path: project list → New → Quick → fill name/code/accounting standard/dates → Back → Quick → verify code retained → Review → Create → verify exact code in list. CMP path: New → search ORCHID → select engagement → verify code is empty/editable rather than inherited → type independent code. Inspected 1280px and 780px layouts. Final screenshots confirm the helper paragraph is absent.

Screenshots (preserved for PR review):

- [Project list](evidence/project-code-independence/list.png)
- [CMP-linked creation](evidence/project-code-independence/create-cmp.png)
- [Narrow layout](evidence/project-code-independence/create-narrow.png)

The browser logged unavailable local Desktop Agent manifest requests and Next.js development instant-navigation diagnostics. These were not treated as a clean console or as production acceptance.

No running local API/database was available; Docker Desktop's Linux engine pipe was absent. Authenticated backend-attached browser acceptance, real database persistence/uniqueness concurrency tests, full root tests, production builds and deployment have not been run. Service/controller tests use mocked persistence; browser mock acceptance does not replace those outstanding checks. The user subsequently authorized PR creation and merge; deployment completion must be verified separately.
