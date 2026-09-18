# Design system contract template

Use this structure for the project-local design contract. Omit irrelevant sections, but keep decisions concrete enough to audit.

For long-lived products, pair this document with `docs/design-system.registry.json`. This document owns rationale, principles, and human-readable decisions. The registry owns component identity, implementation status, paths, state coverage, test evidence, and approved exceptions. When they disagree, stop and reconcile them before continuing.

## 1. Product and visual direction

- Product purpose and primary users
- Three to five visual adjectives
- Reference material and what is being borrowed from each reference
- One proposed design thesis and the assumptions behind it
- Explicit anti-goals
- Target devices and information density
- Accessibility target

## 2. Foundations

Record semantic tokens and their intended roles rather than only listing raw values.

- Color: canvas, surfaces, text, borders, actions, status, focus
- Typography: families, scale, weights, line heights, measure
- Spacing: base unit and semantic gaps/padding
- Shape: radii, borders, control heights
- Elevation: levels and when each is allowed
- Motion: durations, easing, reduced-motion behavior
- Icons and imagery: source, size rules, stroke/fill conventions
- Breakpoints and container widths

## 3. Component architecture

For each public component, record:

- purpose and when not to use it;
- variants and sizes;
- required states;
- accessibility behavior;
- composition rules;
- underlying implementation dependency, if relevant.

Organize the inventory as foundations, primitives, patterns, and layouts.

Expose the machine-readable registry as a human-readable coverage view for continued development:

| Capability | Layer | Status | Public API | Showroom entry | Notes |
| ---------- | ----- | ------ | ---------- | -------------- | ----- |

Use `Required now`, `Ready`, `Planned`, and `Deferred` during planning. Only `Ready` capabilities should be treated as implemented product dependencies.

For long-lived products, record compliance with `minimum-component-baseline.md`, the inferred product-archetype extension, and every user-approved baseline exception.

Use [component-api-contract.md](component-api-contract.md) for public behavior, composition, controlled state, accessibility, and escape-hatch conventions.

## 4. Public boundary

Record:

- design-system source directory;
- product-facing import path;
- third-party UI packages hidden behind the boundary;
- allowed integration or configuration exceptions;
- lint, dependency, or CI rule enforcing the boundary.
- project-local boundary configuration, registry validator, and required CI check;
- owners for public exports, tokens, enforcement configuration, and exceptions.

Example dependency direction:

```text
product screens -> domain components -> design-system public API -> UI library
```

Dependencies must not point back toward product screens.

## 5. Showcase

Record:

- command used to run it;
- URL or route;
- representative viewports;
- included foundations, components, states, and compositions;
- stable pages or stories for each component family;
- the default catalog overview and coverage matrix;
- location of screenshot evidence when stored in the repository.

## 6. Decisions and status

Keep a compact decision table:

| Decision           | Status                        | Evidence or rationale |
| ------------------ | ----------------------------- | --------------------- |
| Visual direction   | Proposed / Approved / Revised | Link or note          |
| Foundations        | Proposed / Approved / Revised | Link or note          |
| Component boundary | Proposed / Approved / Revised | Link or note          |
| Showcase           | Proposed / Approved / Revised | Link or note          |

Do not mark an item approved without an explicit user decision.

## 7. Exceptions

For each exception, record the exact file or subsystem, why the normal rule cannot apply, owner, approval, and expiry. Avoid vague project-wide exemptions. Follow [change-governance.md](change-governance.md) for compatible extensions, material changes, and deprecations, and [quality-gates.md](quality-gates.md) for required enforcement.
