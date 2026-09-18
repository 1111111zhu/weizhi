# Component showroom structure

Use the showroom as the durable visual API for continued product development. Its main job is to expose the system, not to preview one product page.

Use `docs/design-system.registry.json` as the canonical inventory. Derive showroom navigation and coverage summaries from it where the stack permits; otherwise verify the hand-written navigation against it. Do not let documentation and implementation maintain competing status lists.

## Required information architecture

Use stable routes, stories, or equivalent directly reachable entries. For a long-lived product, organize at least:

1. **Overview**
   - approval status, visual principles, component coverage, and change notes;
2. **Foundations**
   - color roles, typography, spacing, shape, elevation, icons, motion, breakpoints;
3. **Actions**
   - Button, IconButton, SplitButton, command or toolbar actions as relevant;
4. **Forms**
   - text inputs, text areas, selects, checkboxes, radios, switches, search, validation;
5. **Navigation**
   - tabs, breadcrumbs, side navigation, menus, pagination, command surfaces;
6. **Feedback and overlays**
   - alerts, badges, progress, skeletons, empty/error states, tooltip, popover, dialog, toast;
7. **Data and content display**
   - cards, lists, tables, metadata, avatars, text/content structures;
8. **Patterns**
   - toolbars, filter bars, form sections, headers, and archetype-derived recurring compositions;
9. **Layouts**
   - shells, page templates, responsive regions, density behavior;
10. **Integration specimens**

- one or two static product-relevant compositions built only after the catalog is credible.

Adapt categories to the product, but keep Overview, Foundations, Components, Patterns, and Layouts distinct. The default route must make the catalog and coverage visible.

## Component page contract

For every public component or coherent family, render:

- purpose and selection guidance;
- anatomy when non-obvious;
- every supported variant and size;
- default, hover/focus, active, selected, disabled, loading, validation, error, and destructive states as applicable;
- empty, long-text, localization, dense-data, and narrow-width stress cases when relevant;
- keyboard and accessibility behavior;
- composition examples and constraints;
- a clear `Ready`, `Experimental`, `Planned`, or `Deprecated` status.

Use the actual exported implementation. Do not reproduce a component visually inside the docs page.

## Long-lived product baseline

Implement [minimum-component-baseline.md](minimum-component-baseline.md) before requesting initial approval. The showroom must contain stable pages for every `Ready` capability in the universal core, cross-page patterns, and the inferred product-archetype extension.

## Coverage matrix

Render a coverage table from the registry, or an equivalent verified view, such as:

| Capability | Layer | Status | Public API | Showroom entry | Notes |
| --- | --- | --- | --- | --- | --- |
| Button | Primitive | Ready | `Button` | `/components/actions` | All states covered |
| Filter bar | Pattern | Planned | — | — | Required before collection views |

Only `Ready` capabilities may be assumed available to product pages. `Planned` entries make future needs visible without pretending they are implemented.

Every `Ready` row must resolve to a real public export, source file, stable showroom entry, covered state set, and verification evidence. The registry validator enforces this contract before approval.

## Initial proposal

Produce one coherent initial proposal from the user's brief. Express its visual direction through the complete showroom rather than a separate set of competing mockups.

If a small preview is useful while building, use a component-led board containing foundations, common states, and one pattern. Treat it as internal progress evidence, not a mandatory user choice gate.

Create multiple alternatives only when the user explicitly asks to compare directions or when a focused clarification exposes genuinely incompatible choices. Do not spend the default workflow building three shallow systems.

## Integration specimens

Build integration specimens last. Keep them static and fixture-driven until product implementation is approved. Their purpose is to prove that the system composes, not to smuggle in the first product screen.

If an integration specimen requires substantial local CSS or raw controls, the catalog is incomplete. Move the missing capability into the appropriate system or domain layer, add its component page, then return to the specimen.
