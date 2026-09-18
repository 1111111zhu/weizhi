# Showcase and approval checklist

Use this checklist before asking the user to approve the system.

## Brief to initial proposal

- Ask only focused questions required to avoid a materially wrong system.
- Synthesize one visual thesis from the product brief, audience, density, brand, and device constraints.
- Build that thesis into the initial design system and complete showroom.
- Ask the user to revise or approve the system as a whole.
- Do not present multiple directions unless the user asks or the brief contains an unresolved incompatible choice.

## Foundations

- Semantic color roles, including focus and status colors
- Typography hierarchy with realistic paragraphs and long labels
- Spacing, radii, borders, elevation, icons, and motion
- Light/dark themes when required by the product

## Components and states

- Default, secondary, quiet, and destructive actions as applicable
- Hover and focus behavior, demonstrated interactively or documented
- Disabled and loading states
- Form labels, help text, validation, and error states
- Dialog, menu, tooltip, toast, or overlay behavior as applicable
- Empty, skeleton/loading, error, and no-permission feedback
- Long text, localization expansion, and dense content

For long-lived products, give each component family a stable page or story and maintain a coverage matrix. The default showroom view must lead to the catalog, not a product mockup.

Confirm every mandatory capability in [minimum-component-baseline.md](minimum-component-baseline.md) is actually `Ready`, exported, and rendered, or has an explicit user-approved exception. Do not accept a gallery containing only components needed by the first feature.

Run `node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --require-ready` before assembling the approval packet. Do not ask for approval while it reports errors; disclose any remaining warnings.

Run the boundary audit in the same packet. The showroom chrome may be narrowly excluded in configuration; its demonstration canvas must remain audited like future product code.

## Patterns, layouts, and integration specimens

Show reusable patterns and layouts independently before combining them. Then show one or two integration specimens selected for the actual product. Useful examples include:

- application shell with header, sidebar, and toolbar;
- data-heavy list or table with filtering and empty/loading/error states;
- form or settings surface with validation;
- dashboard using cards and data visualization;
- detail surface with actions, metadata, and related content.

Do not substitute product-like compositions for the component catalog. Integration specimens are the final proof layer, not the showroom's main content.

## Responsive and accessibility checks

- Inspect a narrow/mobile viewport and a representative desktop viewport.
- Check wrapping, truncation, overflow, sticky regions, and touch targets.
- Navigate interactive examples by keyboard.
- Verify visible focus, labels, semantic controls, and sensible reading order.
- Check contrast and reduced-motion behavior where applicable.

## Approval packet

Provide:

1. run command and route or URL;
2. representative rendered evidence;
3. visual direction and major design decisions;
4. coverage matrix with direct links to foundations, component families, patterns, and layouts;
5. known limitations and open choices;
6. a single clear request to approve, revise, or select an alternative.

Approval applies to the demonstrated system and recorded contract. Material changes to visual language, core layout behavior, or interaction conventions require a new approval decision.

After explicit approval, record the decision in the registry and run the same validation with `--require-approved` before product-screen implementation.

Do not request approval when rendered QA is incomplete. Report what prevented rendering, keep decisions marked Proposed/Unverified, and resume the checkpoint only after the proposal has been inspected.

## Showcase boundary audit

- Keep documentation chrome separate from the product-like demonstration canvas.
- Confirm the demonstration canvas imports through the design-system public API.
- Search the canvas for native interactive controls that bypass system primitives.
- Review showcase-only CSS. Selectors describing product concepts usually indicate a missing pattern, layout, or domain component.
- Allow domain-specific arrangement, but do not introduce new control, surface, typography, or interaction styles outside the system.
