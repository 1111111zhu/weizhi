# Minimum component baseline

Use this baseline for every long-lived, multi-page product. Treat listed items as capability families: framework-specific names and compound APIs may differ, but the behavior and coverage must exist.

The canonical machine-readable inventory is [../assets/minimum-component-baseline.json](../assets/minimum-component-baseline.json). Initialize the project registry through the repository's native Node tooling; do not manually copy this page into a separate checklist. Public component behavior must also follow [component-api-contract.md](component-api-contract.md).

## Contents

1. Foundations
2. Universal core
3. Cross-page patterns
4. Product-archetype extension
5. Readiness requirements
6. Exceptions

## 1. Foundations

Define and demonstrate:

- semantic color roles;
- typography families, scale, weights, line heights, and measure;
- spacing scale;
- radii, borders, and elevation;
- icon sizes and treatment;
- motion durations, easing, and reduced-motion behavior;
- breakpoints, containers, and density rules;
- focus, selection, disabled, read-only, and drag states.

## 2. Universal core

Implement every capability below as a real public design-system API.

### Layout primitives

- `Surface`
- `Container`
- `Stack`
- `Inline`
- `Grid`
- `Divider`
- `ScrollArea`

### Actions

- `Button`
- `IconButton`
- `ButtonGroup`
- `SplitButton`
- `Link`
- `ToggleButton`
- `ToggleGroup`

### Forms

- `Field` with label, description, required, read-only, and error behavior
- `Input`
- `TextArea`
- `SearchInput`
- `NumberInput`
- `Select`
- `Combobox` or autocomplete
- `Checkbox`
- `RadioGroup`
- `Switch`
- `Slider`
- `DateTimePicker` capability
- `FileUpload`

### Navigation and commands

- `Tabs`
- `Breadcrumbs`
- `Menu` family
- `ContextMenu`
- `SideNav` or `NavigationList`
- `Pagination`
- `Toolbar` or `CommandBar`
- `CommandPalette`

The Menu family must cover normal items, checkbox items, radio items, separators, disabled items, destructive items, and nested menus when supported by the chosen interaction model.

### Data and content display

- `Card`
- `Badge` or `StatusBadge`
- `Tag` or `Chip`
- `Avatar`
- `List` and `ListItem`
- `DataTable`
- `TreeView`
- `Accordion` or disclosure
- `DescriptionList` or key-value list

The DataTable capability must cover loading, empty, error, sorting, row selection, long content, horizontal overflow, and a pagination interface. It need not become a spreadsheet engine.

### Feedback

- `Alert`
- `Toast`
- `Spinner`
- `Progress`
- `Skeleton`
- `EmptyState`
- `ErrorState`
- `PermissionDenied`

### Overlays

- `Tooltip`
- `Popover`
- `Dialog`
- `ConfirmDialog`
- `Drawer` or side panel

Overlays must implement keyboard operation, initial focus, focus trapping when modal, Escape behavior, focus restoration, labeling, and scroll handling as applicable. A visual shell is not `Ready`.

## 3. Cross-page patterns

Implement and demonstrate:

- `AppShell`
- `PageHeader`
- `SectionHeader`
- `FormSection`
- `FilterBar`
- `DataToolbar`
- `BulkActionBar`
- `SearchResults`
- `ListPageLayout`
- `DetailPageLayout`
- `FormPageLayout`
- `SettingsLayout`

Patterns must compose public primitives and layout APIs. They must not import the underlying UI library directly.

## 4. Product-archetype extension

Infer additional reusable UI capabilities from the product category, primary entities, repeated workflows, interaction density, target devices, and expected future surfaces.

Add the extension to the design contract and coverage matrix before building the showroom. Include capabilities likely to recur across multiple product areas; exclude business rules, persistence, domain calculations, and one-page-only presentation.

Do not encode a particular brand, named product, or fixed archetype in this reusable baseline. Derive the extension anew for each project.

Mark extension capabilities `Ready` before system approval when the product architecture clearly depends on them. Keep uncertain, highly specialized capabilities `Planned` with a concrete decision trigger.

## 5. Readiness requirements

A capability counts as `Ready` only when:

- it is exported through the design-system public API;
- the showroom renders the actual export on a stable page or story;
- its supported variants and sizes are visible;
- relevant default, hover, focus, active, selected, disabled, read-only, loading, validation, error, and destructive states are covered;
- long text, localization expansion, dense content, and narrow-width behavior are tested where relevant;
- keyboard and accessibility behavior are implemented, not merely documented;
- tokens control its visual decisions;
- typecheck, lint, build, and rendered inspection pass.

Record the implementation, named public export, showroom path, covered states, and verification evidence in `docs/design-system.registry.json`. The public entry must actually export the recorded symbol, the showroom source must reference it, and every evidence path must identify a non-empty file. `Ready` is valid only when `node scripts/design-first/cli.mjs validate-registry ... --require-ready` passes.

For interactive families, exercise real interaction in the showroom. Static pictures do not satisfy readiness.

## 6. Exceptions

Do not omit a universal-core or cross-page capability solely because the first release does not use it.

Allow an exception only when the user explicitly approves it after seeing:

- the exact capability being omitted;
- why it is structurally irrelevant or technically incompatible;
- the future cost of adding it later;
- whether the omission is permanent or deferred.

Record approved exceptions in both the design contract and registry, including approver and timestamp. An agent may recommend an exception but must not approve one itself.
