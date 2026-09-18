# i18n Coding Guidelines

Project Wing product UI must not hardcode user-visible Chinese or English copy outside the i18n layer.

## Scope

These rules apply to EMP, CMP, TMS, IB, and Intranet. Existing hardcoded copy is migration debt; do not add to it. The repository guardrail freezes the current baseline and fails when a new static UI literal is introduced.

## Rules

- Put static UI copy in the owning app's `src/i18n` module. EMP uses `apps/emp/src/i18n/dictionaries.ts`.
- Keep dictionaries as plain serializable data. Do not put functions, React nodes, or runtime logic in dictionary entries.
- Page-level client components may call `useI18n()` directly.
- Reusable components should receive typed `copy` props derived from `Dictionary[...]` instead of calling `useI18n()` internally, unless they already own app-level context such as the page header.
- Component fallback copy must be English, so missing dictionary fields cannot leak Chinese into `/en-US`.
- Tests that assert Chinese UI must pass explicit zh copy. Default component tests should not depend on Chinese fallback text.
- Any new static JSX copy, literal user-visible attribute, or UI view-model field is covered by the global `i18n-static-copy` guardrail. It uses TypeScript AST analysis across product `.ts` and `.tsx` source, including app-local UI wrappers; add copy to the app dictionary instead of expanding the baseline.

## English Capitalization

- Use **Title Case** for short UI labels: navigation items, menu items, buttons, field labels, statuses, and named objects. For example: `Default Folder`.
- Use **sentence case** for complete sentences: descriptions, empty states, help text, confirmations, and errors.
- Do not mechanically change product names, acronyms, file names, codes, or user-provided content.

## Current Allowlist

The EMP hardcoded Chinese guard currently allowlists demo/mock API data only:

- mock API/demo data: `apps/emp/src/api/mock-api.ts`, `apps/emp/src/api/mock-actions.ts`, `apps/emp/src/api/mock-data.ts`

Do not add new files to this list without a matching cleanup issue.
