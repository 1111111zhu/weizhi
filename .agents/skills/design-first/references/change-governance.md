# Design-system change governance

Use this policy after initial approval so the system can evolve without becoming a page-component warehouse.

## Change classes

### Patch

Compatible fixes to implementation, accessibility, responsiveness, documentation, or tokens whose semantic meaning does not change. Keep the public API stable and update evidence.

### Compatible extension

New component, slot, semantic variant, or pattern that preserves existing meaning. Require registry, showroom, tests, boundary audit, and design-system review.

### Material change

Changes to visual language, token meaning, interaction conventions, layout behavior, accessibility contract, or existing public API semantics. Record rationale and migration impact, then obtain renewed user approval before product adoption.

### Deprecation or removal

Mark the old capability `deprecated`, name a real replacement, document migration, and keep the compatibility window appropriate to the project. Remove it only after consumers migrate.

## Admission test

Before adding or extending reusable UI, answer:

1. Can the need be composed from existing public APIs?
2. Does it recur across product areas or encode a stable interaction convention?
3. Is it business content that belongs in a domain component instead?
4. Is the proposed API semantic, finite, accessible, and independent of one page?
5. What existing capability, if any, should it replace?

Reject page nouns, business rules, persistence, and one-off visual overrides from primitives. Prefer a domain component composed from the system when reuse is tied to a business concept.

## Ownership and review

- Assign design-system directory ownership with the repository's review mechanism, such as `CODEOWNERS`.
- Require an owner review for public exports, tokens, registry, showroom, enforcement configuration, and exceptions.
- Protect the required CI checks on the main branch.
- Review changes to audit rules and workflow files as security-sensitive governance changes.
- Keep exception approval separate from implementation authorship.

## Drift control

Audit the repository periodically and during every relevant pull request. Track:

- direct underlying-library and deep imports;
- repeated page-local controls or patterns;
- growth in escape-hatch usage;
- stale or expired exceptions;
- deprecated components with remaining consumers;
- public exports missing from the registry or showroom;
- visual-regression churn that indicates unstable tokens or layouts.

Fix drift at the smallest shared layer and migrate consumers. Do not normalize a violation by adding a broad exception.
