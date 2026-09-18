# ProjectWing Design System Discovery

Status: `Proposed`

Date: 2026-08-14

This document records the DesignFirst discovery baseline for ProjectWing. It separates observed repository facts from proposed design direction. It does not approve a design system, mark components as ready, change product UI, or enable a new CI gate.

## Classification

- Work type: existing inconsistent UI
- Product scale: long-lived, multi-application platform
- Product archetype: bilingual CPA firm operations workbench with an external client collaboration boundary
- Governance approach: consolidate touched surfaces incrementally; do not rewrite unrelated screens

ProjectWing contains five product frontends in the current UI guardrail scope: EMP, CMP, TMS, Intranet, and IB. EMP, CMP, TMS, and Intranet are internal staff systems. IB is an external client surface and must preserve a narrower information and interaction boundary.

## Product constraints

### Observed facts

- EMP and CMP are dense, desktop-oriented workspaces with data grids, filters, dialogs, sheets, document review, and long-running workflows.
- TMS uses the same platform identity but has timesheet, approval, query, and reporting patterns.
- Intranet is a lighter internal entry point and knowledge surface.
- IB is still a minimal shell; its design system consumption model is not established.
- Product copy is bilingual Chinese and English and is governed through app-owned i18n dictionaries.
- Light and dark themes exist across the implemented internal applications.
- Existing brand assets consistently use the ProjectWing black/white mark with a green accent.
- Existing semantic themes converge on restrained green actions with neutral slate or navy surfaces.
- Desktop is the primary interaction environment for the implemented workbenches, but responsive behavior is already a delivery requirement.
- Product workflows include consequential, permission-sensitive, and auditable actions. State clarity is more important than decorative novelty.

### Proposed accessibility target

- Treat WCAG 2.2 AA as the default target for shared components and representative workflows.
- Preserve visible focus, keyboard operation, accessible names, reduced-motion behavior, and non-color state cues.
- Validate dense data and document workflows at desktop widths and validate core navigation and forms at narrow widths.

This target is proposed because the repository already enforces accessible names and requires interactive browser verification, but it is not yet recorded as an approved project-wide contract.

## Existing UI architecture

### Shared package

`packages/ui` is the current cross-application package and is already imported as `@project-wing/ui`. All implemented internal app style entrypoints import `@project-wing/ui/styles.css`.

The package currently exports 27 modules. Its public surface is weighted toward platform compositions and behaviors:

- authentication and development account selection;
- top-bar identity, search, account, and layout coordination;
- toast infrastructure;
- motion inputs, buttons, popovers, and action bars;
- theme providers and shared interaction helpers.

It is not yet the canonical public home for the complete primitive inventory. Most Button, Input, Select, Dialog, Tabs, Card, and related wrappers remain app-local.

### App-local primitive layers

Observed TypeScript source files under each `src/components/ui` directory:

| Application | UI files | Notes |
| --- | --: | --- |
| EMP | 41 | Broadest primitive set; includes document, layout, form, feedback, and navigation controls |
| CMP | 22 | Core form and overlay primitives; master-data UI remains heavily app-specific |
| TMS | 16 | Core controls plus calendar and chart wrappers |
| Intranet | 10 | Smaller shadcn layer while some product code still uses Fluent UI |
| IB | 0 | No established component boundary yet |

The app-local layers are an intentional shadcn installation boundary today. Under DesignFirst they should be treated as a transitional implementation layer until the public cross-application contract is defined. Existing imports are not automatically violations.

### Underlying UI dependencies

Non-test source files currently importing selected UI libraries directly:

| Package | Files | Interpretation |
| --- | --: | --- |
| `@base-ui/react` | 82 | Primarily wrapper implementations, with boundary exceptions governed by the existing scanner |
| `@fluentui/react-components` | 6 | Intranet-specific legacy or integration surface |
| `@fluentui/react-icons` | 5 | Intranet-specific legacy icon surface |
| `lucide-react` | 133 | Current approved product icon library |
| `motion` | 18 | Shared and application motion behavior |
| `@tanstack/react-table` | 24 | EMP/CMP data behavior |
| `@glideapps/glide-data-grid` | 2 | Spreadsheet-like data interaction |
| `@xyflow/react` | 3 | CMP entity graph and map behavior |

The boundary audit must distinguish a design-system implementation dependency from a product-code bypass. A raw import count is an inventory signal, not proof of a violation.

### Existing public-boundary usage

- 38 TypeScript source matches import from `@project-wing/ui`.
- App-local `@/components/ui/*` imports appear in 83 EMP files, 26 CMP files, 11 TMS files, and 5 Intranet files.
- The repository therefore has two active UI dependency directions: shared platform compositions and app-local primitives.

The next phase must define how these two layers converge without breaking app-local shadcn workflows.

## Foundations inventory

### Color and theme

The implemented internal apps already express a recognizable shared language:

- green primary actions and focus states;
- slate or navy foreground, background, muted, and border surfaces;
- pale green brand tints for restrained emphasis;
- semantic variables for background, foreground, primary, secondary, muted, accent, destructive, border, input, and ring;
- light and dark modes.

The token values are duplicated or independently expressed across app style entrypoints. EMP and TMS are closely aligned; CMP contains a much larger app-specific stylesheet; Intranet expresses similar intent using its own OKLCH values.

### Typography

- Workbench body typography uses a system-oriented sans-serif stack.
- IBM Plex Serif or equivalent serif fallbacks appear in editorial, authentication, or document-like contexts.
- EMP includes document-specific typography such as spreadsheet and Chinese document fallbacks.

Typography roles exist in implementation but are not yet recorded as one cross-application semantic scale.

### Radius, elevation, and motion

- A `0.625rem` base radius appears in implemented themes.
- Existing guardrails already discourage nested card surfaces and redundant shadow containers.
- EMP and TMS share fast, normal, panel, and emphasized motion timing concepts.
- Motion is present in both the shared package and application code, but its semantic roles and reduced-motion contract are not centralized.

## Repeated product patterns

Repository search confirms repeated families that should be classified during registry work:

- application shell, top bar, sidebar, and account controls;
- dense workbench and split-panel layouts;
- data grids, tables, filters, toolbars, and pagination;
- form sections, validation summaries, and approval comparisons;
- dialogs, sheets, drawers, popovers, and destructive confirmations;
- loading, empty, unavailable, permission-denied, and error states;
- document preview, file selection, upload, replacement, version, and export;
- workflow status, audit evidence, review questions, signoff, and approval actions.

These are candidate primitives, patterns, layouts, or domain components. Search frequency alone does not determine their final layer.

## Existing enforcement baseline

The repository already runs `scripts/ui-stack-guardrails.mjs` over all five product frontends. The current baseline is explicitly a debt freeze rather than an allowlist.

Recorded non-i18n debt:

| Rule                     | Count |
| ------------------------ | ----: |
| Native controls          |    11 |
| Date calendar controls   |     2 |
| Native title attributes  |     2 |
| Other restricted syntax  |     4 |
| Ungrouped shadcn buttons |     3 |

The static-copy baseline contains 633 occurrences across 46 files. DesignFirst must preserve this scanner and its fingerprints rather than replace them with a competing audit model.

## Proposed design thesis

ProjectWing should feel like a precise professional workbench: calm neutral surfaces, restrained WZ green for action and state, dense information without visual noise, and document-aware typography where evidence or formal communication requires it. Interaction should make ownership, permission, progress, and consequence obvious. Motion should explain causality and continuity rather than decorate the interface.

### Rationale

- The product is used for sustained professional work rather than casual browsing.
- Audit, approval, timesheet, and client-master workflows reward clarity and comparison.
- The existing green, slate, navy, and serif accents provide real brand evidence and should be consolidated rather than replaced.
- A shared visual language must support both dense internal tools and a calmer external IB experience.

### Assumptions

- EMP, CMP, TMS, Intranet, and IB share foundations and public primitives.
- System-specific patterns and layouts may vary by task density and audience.
- EMP remains the densest interaction model; IB should not inherit internal workbench density by default.
- Existing brand marks and the green accent remain authoritative unless a later brand decision changes them.

### Anti-goals

- Do not turn every workflow into a stack of rounded cards.
- Do not use green as a general background decoration or substitute for hierarchy.
- Do not create a separate primitive vocabulary for each app.
- Do not make product pages depend directly on third-party component APIs.
- Do not mass-rewrite stable screens solely to satisfy a new directory structure.
- Do not treat a component as ready because it renders once or has a source file.
- Do not freeze bug fixes or small visual corrections while the initial showroom is being established.

## Proposed consolidation direction

This direction is provisional and must become an explicit contract in the next phase.

1. `@project-wing/ui` becomes the public boundary for cross-system foundations, primitives, and stable platform patterns.
2. Underlying UI libraries remain private implementation dependencies behind approved wrappers or narrow infrastructure adapters.
3. Application directories retain domain components that encode EMP, CMP, TMS, Intranet, or IB business concepts, but their visual building blocks come through the public system.
4. Existing app-local shadcn wrappers remain supported during migration. Their ownership, convergence path, and allowed import surface must be recorded before strict enforcement.
5. The showroom renders real public exports and representative domain compositions; it does not become a parallel mock UI.
6. Existing `ui-stack-guardrails` remains the enforcement entrypoint. DesignFirst validation should be integrated into it or its existing CI lane rather than added as an independent workflow.

## Adoption constraints

- Start in reporting mode; do not run a full strict boundary audit as a required CI check against historical code.
- Protect new and touched UI first.
- Record legacy exceptions with an owner, reason, and intended retirement scope.
- Do not update the existing baseline merely to accept new debt.
- Preserve current shadcn CLI rules and repository dependency overrides.
- Require rendered inspection before visual approval or completion claims.

## Next phase

Establish the project-local design contract and boundary map:

- define foundations, primitives, patterns, layouts, and domain-component ownership;
- choose the canonical public entry and transitional app-local entries;
- define component status and approval semantics;
- map existing guardrail categories into DesignFirst boundary rules;
- decide where the multi-application showroom will live;
- define the initial ProjectWing-specific capability extension before initializing the registry.

No enforcement configuration or component registry should be generated until that contract is reviewed for fit with the existing monorepo.

## Reproduction notes

The inventory was generated from the repository at the date above using `rg`, the frontend package manifests, app-local `components.json` files, `packages/ui/src/index.ts`, app style entrypoints, `docs/ui-stack-guardrails.md`, and `scripts/ui-stack-baseline.json`. Counts exclude test and spec files where stated.
