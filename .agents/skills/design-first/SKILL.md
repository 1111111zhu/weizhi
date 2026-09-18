---
name: design-first
description: Establish, approve, and enforce a project-specific design system and component showroom before implementing product interfaces. Use when an AI coding agent or development team is creating a new web app or substantial frontend surface, building a long-lived multi-page product, redesigning an application, introducing a component library, or applying design-first development, visual consistency, design tokens, shared components, or a design-system-first workflow. Do not use for tiny fixes that cannot affect the product's visual language.
---

# Design First

Treat the design system as product architecture, not decoration. Fix the visual language and UI composition rules before building product screens, then require all product UI to pass through that system.

## Non-negotiable rules

- Do not implement product screens before the user approves the representative showcase. Screens built only to demonstrate the proposed system are allowed.
- Do not invent a visual direction from generic defaults. Derive it from product context, existing brand material, user references, or explicit alternatives shown to the user.
- Keep third-party UI libraries behind the design-system boundary. Product code must import from the project's design-system public API, never directly from a UI kit.
- Do not use raw colors, spacing, radii, shadows, typography, or motion values in product UI when a semantic token should exist.
- Do not create page-local substitutes for reusable UI. Add missing primitives, patterns, or layouts to the design system first, demonstrate them, and then consume them.
- Do not silently change approved design decisions. Record material changes and obtain approval when they alter the product's visual language or interaction model.
- Do not declare the design system approved without an explicit user decision. A request to proceed autonomously may count only when the user clearly waives the checkpoint.
- Do not request visual approval from source code alone. Run and inspect the proposal first. If rendered inspection is blocked, report the proposal as unverified and blocked instead of asking the user to approve it.
- Do not use simulated product pages as a substitute for the design-system showroom. The primary approval surface must be a navigable catalog of foundations, components, states, patterns, and layouts. Product-like compositions are secondary integration evidence.
- Do not present multiple visual directions by default. Turn the user's brief into one coherent initial design-system proposal, then let the user revise or approve that proposal. Offer alternatives only when the user requests them or a genuinely unresolved decision cannot be settled with focused questions.
- For a long-lived product, do not omit a mandatory baseline capability because the first feature does not use it. Follow [references/minimum-component-baseline.md](references/minimum-component-baseline.md). Require explicit user approval for any baseline exception.
- Do not self-declare a component `Ready`. Its registry entry, implementation, showroom evidence, state coverage, and verification evidence must pass the registry validator.
- Do not rely on instructions alone to protect the boundary. Maintain repository-local enforcement and make its checks required in CI for long-lived products.

## Classify the work

Choose the path before editing:

1. **Greenfield**: create a visual direction and new system before product implementation.
2. **Existing approved system**: inspect and reuse it; extend it only through the gap protocol.
3. **Existing inconsistent UI**: inventory the current language, propose a consolidation plan, and apply Design First to the touched surface. Do not casually rewrite unrelated screens.
4. **Small visual fix**: follow the existing system without starting a full design phase.

Also classify product scale. Treat software expected to grow across multiple pages, features, or sustained development as a **long-lived product**. Give it a durable component registry and multi-page showroom. Do not optimize this path for a one-shot screenshot.

For React or TypeScript projects, read [references/react-typescript-enforcement.md](references/react-typescript-enforcement.md). For other stacks, translate the same dependency direction and enforcement principles into native conventions.

## Phase 1: Discover constraints

Inspect the repository before proposing UI. Locate:

- existing tokens, global styles, component directories, UI dependencies, fonts, icons, and assets;
- representative screens and repeated interface patterns;
- product audience, primary tasks, content density, devices, accessibility requirements, and brand constraints;
- supplied screenshots, design files, reference products, or written preferences.

Separate facts from proposals. Preserve established brand or product decisions unless the user requested a redesign.

For greenfield work, establish a viable minimal toolchain before substantial UI work. Prefer the stack's official scaffold or mutually compatible pinned major versions; do not assemble a manifest from unconstrained `latest` dependencies. Prove the empty scaffold can install, typecheck, lint, build, and start before investing in the showcase.

If the brief omits a material constraint, ask no more than three focused questions covering issues such as audience, density, brand character, device priority, or accessibility. Do not turn every aesthetic decision into a user questionnaire.

Then synthesize one explicit design thesis and proceed to the initial design system and showroom. Record the thesis, rationale, assumptions, and anti-goals as `Proposed`. Make a judgment from product evidence; do not average unrelated visual styles. There is no separate visual-direction approval gate by default—the user reviews direction through the complete initial showroom.

## Phase 2: Establish the contract

Create or update a project-local design contract. Prefer an existing documentation convention; otherwise use `docs/design-system.md`. Use the structure in [references/design-system-contract.md](references/design-system-contract.md).

For this ProjectWing workspace, enforcement is owned by the repository's native Node tooling. Do not copy or install a second validator bundle into the project. Inspect `scripts/design-first/cli.mjs`, `.design-first/assets/`, and `.design-first/provenance/` first; extend those contracts when the architecture changes. Keep `design-first.boundary.json` and `docs/design-system.registry.json` as the project-level boundary and registry inputs, while generated provenance remains under `.design-first/provenance/`.

Run the native gates from the repository root:

```text
node scripts/design-first/cli.mjs --json
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --require-ready
```

If equivalent enforcement already exists, extend it instead of installing a competing workflow. Keep CI commands aligned with the repository package manager and native workspace checks.

Read [references/quality-gates.md](references/quality-gates.md) while configuring enforcement. Keep the generated schemas with the portable validators. Treat the Markdown contract as rationale and human-readable guidance; treat the registry as authoritative for component identity, layer, status, paths, state coverage, verification evidence, and approved exceptions.

Define the system in dependency order:

1. **Foundations**: semantic color, typography, spacing, radius, elevation, border, icon, and motion tokens.
2. **Primitives**: Button, Input, Select, Checkbox, Dialog, Card, Tabs, Tooltip, and other atomic controls.
3. **Patterns**: Header, Toolbar, Sidebar, FilterBar, FormSection, DataTable, EmptyState, and recurring product compositions.
4. **Layouts**: AppShell and the page structures needed by the product.

Create a component coverage matrix before building the showroom. Mark each relevant capability as `Required now`, `Ready`, `Planned`, or `Deferred`, with its layer and showcase location. For a long-lived product, include the common cross-page baseline—not only components needed by the first screen.

For a long-lived product, implement the universal core and cross-page patterns in [references/minimum-component-baseline.md](references/minimum-component-baseline.md) as `Ready` before requesting initial system approval. Infer an additional product-archetype extension from the brief and expected workflows. Do not hard-code a brand or one product category into the reusable skill. Defer only specialized capabilities whose behavior cannot yet be designed responsibly.

Keep names semantic. Prefer `surface-muted` over `gray-100`, `space-control-x` over an unexplained number, and variants such as `danger` or `quiet` over page-specific names.

Define a single public import surface for product code. The design system may wrap, adapt, or compose third-party primitives internally. Keep library-specific props and styling details out of product-facing APIs.

Read [references/component-api-contract.md](references/component-api-contract.md) before defining public components. Record each component in the registry as soon as it is planned, and update the same entry as implementation and evidence are added.

Add mechanical enforcement while establishing the boundary. At minimum, prevent direct third-party UI imports outside the design-system implementation. Where the stack permits, also flag deep imports and unapproved raw style values.

Run the boundary audit after configuring real source roots, public imports, underlying packages, and the narrow showcase-chrome directory:

```text
node scripts/design-first/cli.mjs --json
```

Keep exceptions narrow, owned, and time-bounded. Do not exempt the showroom demonstration canvas.

## Phase 3: Build the showcase

Create a dedicated, runnable component showroom using the project's natural tooling: internal routes, Storybook, a component explorer, or equivalent. Do not build a disconnected static mockup when real components can be exercised. Read [references/component-showroom.md](references/component-showroom.md) and [references/minimum-component-baseline.md](references/minimum-component-baseline.md), then use their information architecture and coverage requirements.

Generate or reconcile showroom navigation and the visible coverage matrix from the registry where practical. Do not maintain a second, contradictory hand-written inventory.

The showroom's default route must be a catalog overview, not a simulated product screen. Build the evidence in this order:

1. foundations;
2. primitive component categories and complete state matrices;
3. patterns;
4. layouts;
5. one or two product-relevant integration specimens.

Give components or coherent component families stable, directly reachable pages or stories. Each public component must show purpose, variants, sizes, states, accessibility behavior, composition guidance, and relevant stress cases. A gallery of isolated happy-path controls is insufficient.

Apply the design-system boundary while building the showcase. Separate:

- **Showcase chrome**: documentation navigation, annotations, viewport controls, and comparison framing. It may have small, isolated showcase-only styles.
- **Demonstration canvas**: every product-like surface inside the examples. It must use the design-system public API and the same domain-component rules as future product code.

Do not hide missing system capabilities in a large showcase stylesheet. If showcase-only CSS defines product concepts such as a reply composer, message row, filter bar, toolbar, card variant, or page layout, move that capability into the appropriate primitive, pattern, layout, or domain demonstration component. Apply the gap protocol during showcase construction.

Outside the design-system implementation, do not use raw interactive elements such as `button`, `input`, `select`, `textarea`, `dialog`, or product data tables inside the demonstration canvas when the system should provide the corresponding control. Native elements are acceptable inside design-system implementations and narrowly scoped showcase chrome.

The showcase must render the actual exported components and cover:

- foundations and the complete `Ready` component inventory;
- default, hover/focus where demonstrable, disabled, loading, validation, and error states;
- realistic long text, empty content, dense data, and destructive actions;
- representative desktop and narrow/mobile layouts;
- one or two compositions that prove components integrate for real product work. These must appear after the catalog and must not be the primary approval evidence.

Use [references/showcase-and-approval.md](references/showcase-and-approval.md) as the completion checklist. Run the app and inspect the rendered result at relevant viewports. Fix visual breakage and console errors before presenting it. If dependencies, build, server startup, or rendering are blocked, preserve the work but stop with an unverified status; do not advance to approval.

Before requesting approval, validate the registry against the project and require the mandatory inventory to be genuinely ready:

```text
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --require-ready
```

Fix every error before advancing. Warnings must be resolved or disclosed in the approval packet.

## Phase 4: Request approval

Present an approval packet with:

- how to open the showcase;
- screenshots or rendered evidence at representative viewports;
- the chosen visual direction and important tokens;
- the component coverage matrix and direct links to component-family pages;
- the pattern and layout inventory;
- any open decisions or deliberate limitations.

Ask for one project-level decision: approve or revise the proposed system. If the user explicitly requested alternatives, include selection among them. Do not make the user approve every atomic component.

Stop before implementing product screens until approval is explicit, unless the user clearly waived this checkpoint.

After approval, record the approver and timestamp in the registry and verify the approved gate:

```text
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --require-ready --require-approved
```

## Phase 5: Implement through the system

After approval:

- compose product screens only from the design-system public API and domain components built from it;
- keep page files focused on data, state, permissions, and composition rather than visual invention;
- reuse defined layouts and patterns before introducing variants;
- verify responsive behavior, accessibility, and the approved visual language as each meaningful screen is completed.

Read [references/change-governance.md](references/change-governance.md) before changing approved tokens, public APIs, layouts, audit rules, exceptions, or approval state. Classify changes as patches, compatible extensions, material changes, or deprecations and apply the corresponding review.

### Gap protocol

When a needed UI capability is missing:

1. Search the existing primitives, variants, patterns, and layouts for a valid composition.
2. Decide whether the need is reusable UI or genuinely domain-specific content.
3. If reusable, add or extend the smallest appropriate design-system layer.
4. Use tokens and preserve the public API boundary.
5. Add the new capability and its important states to the showcase.
6. Update its registry paths, required and covered states, test evidence, and status.
7. Run the registry validator and validate the capability in isolation, then use it in the product screen.
8. Record material contract changes. Ask for renewed approval only if the change alters the approved visual language or interaction model.

Domain components may live outside the design system when they encode business concepts, but their visual building blocks must still come from the system.

## Phase 6: Audit before completion

Before declaring UI work complete:

- search product code for direct imports from underlying UI libraries;
- search product code and the showcase demonstration canvas for raw interactive elements that bypass system primitives;
- search for raw or arbitrary style values that bypass tokens;
- search for duplicated controls, layouts, and page-local component variants;
- inspect showcase-only styles for product-facing selectors that conceal missing primitives, patterns, or layouts;
- confirm every new reusable component appears in the showcase;
- compare public exports with the registry and showroom so no `Ready` component is undocumented;
- run the registry validator with `--project-root`, `--require-ready`, and, after approval, `--require-approved`;
- run the boundary audit and fail on every unapproved error or expired exception;
- confirm the default showroom route and most approval evidence are component-led rather than product-page-led;
- inspect representative screens at narrow and wide widths;
- check keyboard focus, labels, contrast, loading, empty, validation, and error behavior;
- run the repository's lint, typecheck, test, and build commands as applicable.
- run the configured accessibility, showroom-build, responsive, and visual-regression gates.

Report any intentional exceptions with their exact location and reason. Treat an unexplained boundary violation as unfinished work.

## Keep the system proportional

Build only what the product evidence supports. A small application may need a compact catalog. A long-lived multi-page product needs a broader common baseline and stable showroom structure even when its first feature is simple. Do not confuse proportional scope with designing only the first product page.
