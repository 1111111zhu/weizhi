# ProjectWing Design System Contract

Status: `Approved for SmartForm product adoption`

Approved by: User

Approved at: 2026-08-28

Date: 2026-08-14

This contract defines the proposed visual language, component architecture, public UI boundary, approval model, and migration rules for ProjectWing. It is not approved until the representative showroom is implemented, rendered, inspected, and explicitly approved by the user.

The discovery evidence behind this contract is recorded in [design-system-discovery.md](design-system-discovery.md). The future machine-readable source of truth for component identity, implementation status, source paths, showroom evidence, verification, and approved exceptions is `docs/design-system.registry.json`. If that registry and this contract disagree, UI work must stop until they are reconciled.

## 1. Product and visual direction

### Mobile Material 3 scope clarification (2026-09-11)

The latest user instruction confines the Material 3 refactor to mobile. Desktop styling and behavior remain unchanged. The existing desktop palette and component defaults must not be replaced. Shared mobile semantic tokens and state rules are gated by `(width < 48rem)`; mobile runtime adaptations use the matching compact viewport. This is one shared component system with responsive presentation, not a second application stack. Implementation was directly authorized; global visual approval and backend acceptance remain pending. See [the mobile Material 3 implementation and validation record](mobile-material3.md). Newly exported Material controls remain `experimental` in the registry.

### Guided enterprise form proposal (2026-09-06)

The review step now reuses the approved grouped section presentation: equal-width desktop columns, project details and dates on the left, source and members on the right, with responsive stacking. Section headings remain outside rounded information groups; members are separated rows rather than nested cards. This is a presentation-only composition of the existing public GuidedForm API; editing and submission remain EMP-owned.

Latest setup clarification retains the summary. The user-requested grouped presentation follows the supplied settings reference: headings outside light rounded section groups, generous row padding, labels and controls aligned on separate desktop columns, and dates/initialization options arranged vertically. There is no outer page card. The live summary stays in the desktop side rail and moves below on narrow screens. This presentation is owned by the shared GuidedForm family; creation data and workflow ownership remain in EMP.

Current user-requested entrance refinement: personalized Welcome back greeting and two neutral action cards. Regular focuses CMP search; selecting a valid business enters setup. Quick enters setup immediately without CMP search. No Next button or radio-selection navigation remains on the entrance. No second-step domain rule or submission payload changes.

Follow-up first-screen revision: `Approved for EMP adoption — User, 2026-09-06`. The user approved the rendered centered greeting/search entrance ('不错，放到那边去'). `GuidedFormIntro` now replaces the product's first-step card and mode controls. It uses the current user's display name with a neutral loading/empty-name fallback and bilingual copy. CMP is the default path and requires a selected business; the quiet quick-create action immediately enters setup. Returning to the entrance restores the CMP search path while preserving user-entered project settings. The second-step form and its business rules remain unchanged. This is scoped adoption, not a global approval or remote release.

Status: `Approved for EMP project-creation adoption — User, 2026-09-06`. After reviewing and refining the rendered showroom, the user explicitly requested “接入生产页面”. The scoped GuidedForm family uses the existing neutral/green system with a compact step rail, aligned field states, explicit single selection, a secondary metadata rail and in-flow footer actions. Templates, archived source projects and CMP businesses use one editable search input with below-anchor results, not nested dropdown/search controls. ServiceNow Horizon is a structural reference, not a new brand/theme. The real EMP `new-project.tsx` now consumes this public family while retaining domain validation, remote availability filtering, folder scope, initialization, dates, ownership and invitations. The actual exported components remain demonstrated at `/specimens/GuidedForm`; see [the proposal and evidence record](project-creation-enterprise-proposal.md). This scoped approval does not alter project-wide approval or certify a production deployment; no real backend environment is currently available for end-to-end acceptance.

### TMS EMP-project approval hierarchy (2026-09-04)

Status: `Approved — user approved the rendered workbench on 2026-09-04`

TMS approval uses a master-detail workbench: the left rail selects one CMP Engagement through a compact modern list whose rows contain only the business code and client name; all project counts, lifecycle labels, and approval badges belong in the selected workspace instead. The right workspace never mixes projects from different CMP Engagements, and changing the selected CMP clears the current batch selection so an approval cannot cross a business boundary. The active CMP header combines its code, save state, client and owner context, period selectors, and contextual batch action; the project-count summary row and bottom action bar are deliberately omitted. Within the active CMP, each EMP Project is the explicit batch scope. The atomic approval record is one employee, one EMP project, and one half-month. Each project owns its expandable employee table, column header, clipping context, and horizontal scrollbar; there is no CMP-level table header or shared scrollbar above or below the project hierarchy. Expanding a project reveals the full daily evidence matrix: Employee, Action, and Status are vertically centered across the Normal and OT rows; Type, daily hours, totals, and descriptions remain row-specific; every day in the selected period has its own column; and weekends are visually quiet. Every employee has visible approve/return actions, while approved records expose undo. Batch actions state their exact project scope and execute as employee-level records with project-scoped audit results. Blocked and already approved records remain visible but cannot be selected. The user approved the rendered hierarchy and authorized product adoption on 2026-09-04.

### Purpose and users

ProjectWing is a bilingual CPA firm operations platform. Its internal systems support engagement execution, client and engagement master data, timesheets, knowledge, review, approval, document, and audit-evidence workflows. Its external IB surface supports controlled client collaboration without exposing internal workspaces.

Primary users are firm staff performing sustained, accuracy-sensitive work. External client users form a separate, lower-density audience with a narrower task and information boundary.

### Visual character

The proposed visual character is:

- precise;
- calm;
- evidence-led;
- compact where the task requires density;
- restrained rather than decorative.

### Design thesis

ProjectWing should feel like a precise professional workbench: calm neutral surfaces, restrained WZ green for action and state, dense information without visual noise, and document-aware typography where evidence or formal communication requires it. Interaction must make ownership, permission, progress, and consequence obvious. Motion explains causality and continuity rather than decorating the interface.

### Reference evidence

The proposal derives from repository evidence rather than a generic visual preset:

- existing ProjectWing black/white and green brand assets;
- shared green, slate, and navy semantic themes across implemented apps;
- existing dark themes;
- IBM Plex Serif and document typography in formal or evidence-oriented contexts;
- existing dense workbench, data-grid, review, approval, and document workflows;
- current UI guardrails against decorative headings, nested cards, raw values, and ungrouped actions.

### Anti-goals

- Do not turn every workflow into a collection of floating cards.
- Do not use green as decoration or as a substitute for hierarchy.
- Do not create separate primitive vocabularies for EMP, CMP, TMS, Intranet, and IB.
- Do not expose third-party component APIs through product-facing components.
- Do not encode business nouns or page names into primitive props.
- Do not use animation without interaction, continuity, or feedback purpose.
- Do not mass-rewrite stable screens solely to satisfy a target directory structure.
- Do not block unrelated bug fixes while the initial showroom is being established.

### SmartForm editor chrome proposal

Status: `Approved for SmartForm product adoption`

Approved by: User Approved at: 2026-08-28

The SmartForm editor adopts a Fluent-inspired professional command surface without importing Fluent UI directly or creating a second primitive system. The proposal uses the existing ProjectWing semantic tokens and public controls with compact command groups, calm neutral layers, restrained selection green, visible saved state, and lower-frequency or destructive actions moved out of the primary path. The template rail and editor command bar remain domain compositions until evidence confirms which capabilities should graduate to shared Toolbar or navigation patterns. The user approved the rendered desktop, dark-theme, and narrow-width proposal on 2026-08-28. This approval is limited to the SmartForm template rail and editor command bar; it does not mark the project-wide design system as approved.

The SmartForm entry workbench received a compatible enterprise-density extension on 2026-09-02 after explicit user approval. The entry surface uses a compact document identity bar, required-response progress, collapsible top-level guidance, a reversible focus mode, and a lighter fixed-sheet table treatment. Table groups rely on quiet neutral surfaces and thin separators; required markers appear only for genuinely required inputs. Audit-procedure sheets reserve additional width for working-paper references and use taller, consistently aligned editor rows. Reference selection uses a floating, searchable hierarchy of all current-period working papers instead of a flat dropdown. While any SmartForm is open—Master or read-only—the global bottom review-notes rail is hidden because SmartForm provides contextual review-question entry inside the document. These changes do not alter the stored SmartForm schema or workflow rules.

### PDF template designer proposal (2026-08-29)

The confirmation template editor is evaluating pdfme behind the experimental `@project-wing/pdf-template-designer` adapter. The adapter owns every pdfme import and exposes ProjectWing-controlled Designer and Form contracts; EMP product code must not import pdfme directly. The proposal keeps an immutable PDF base, represents editable regions as an independent JSON schema, uses stable business-binding names, and generates or flattens a final PDF only at explicit preview, download, or submission boundaries. Field input and field-wide WYSIWYG formatting must not recreate the PDF viewer. Filling controls may change the registered font variant, point size, bold, italic, and underline properties, but must never expose Markdown or another storage syntax in the editable text. The first approval surface was the interactive `/blocks#pdf-template-designer` showroom specimen; the user explicitly approved the rendered Office layout on 2026-08-29.

The user initially approved product adoption on 2026-08-29 without font-family selection, then explicitly reopened that decision for redistributable open-source fonts. The filling surface keeps open-source font family, point size, bold, italic, underline, text color, background color, and alignment controls; formatting is WYSIWYG and stored as field style metadata while field values remain plain text. Background is transparent by default and only covers PDF source content after the user chooses a color. New template authoring exposes six confirmation-focused field types: single-line text, multiline text, static text, radio, number, and date. Static text is fixed template content and never owns a submitted field value. Checkbox and dropdown fields remain readable and editable only for backward compatibility with existing templates; they are not new-field insertion choices. Fillable fields use one `Default fill` interaction: text fields may copy from confirmation base information or the confirmation information library, all authored value types may store a type-safe custom value, and date fields may use the current date. Defaults are copied into the field's own value once available, remain user-editable, and never mutate the source record. The authoring preview is ephemeral, suppresses all defaults and contextual data, and never saves preview input. Radio values remain single-select and use a compact dropdown trigger with a complete option popup, but the trigger must preserve the exact field geometry and the same neutral field styling as every other fill control. Enabled designs use the semantic success color and icon. The selectable families are limited to Noto Sans SC, Noto Sans, Liberation Sans, and Liberation Serif. Legacy Arial, Microsoft YaHei, and Times New Roman values remain readable for backward compatibility but are not offered in the Ribbon. The anti-goals are exposing Ant Design or pdfme props to product code, adding fonts without an embedding/redistribution path, and treating a field hit target as an implicit instruction to erase all PDF content underneath it.

The layout proposal was revised on 2026-08-29 in response to the squeezed permanent three-column workbench. The approved version uses an Office-style top Ribbon for view, active-field, and formatting commands; the PDF canvas is the sole primary surface; and the secondary property inspector is collapsed by default and opens on demand. Designer and fill modes consume the same template schema, including page, position, dimensions, value, point size, registered font variant, and underline metadata. The approved layout is implemented in the EMP template workbench. Prompt text uses a proportional HTML layer instead of the non-uniform SVG coordinate transform, so glyph width is preserved. Field geometry has three explicit states: a live blue eight-handle frame while drawing, an idle dashed outline, and an interactive blue eight-handle frame with an adjacent delete action after placement. Dynamic fill controls remain transparent so PDF source content is visible; only explicit mask fields erase source content.

The insertion group follows the approved compact Office treatment: equal-width commands use an 18px icon above an 11px label, a centered 10px group caption below, and low-contrast vertical dividers. The user-facing field contract includes `TEXT`, `MULTILINE`, `NUMBER`, `DATE`, `CHECKBOX`, `SELECT`, and `RADIO`; `MASK` remains an internal source-erasure tool. Every user-facing kind must survive template validation, draft persistence, fill rendering, and PDF/DOCX materialization. Multiline values preserve line breaks, checkboxes serialize as `true` or `false`, and select/radio values must match a configured option.

The full Ribbon mirrors the supplied Office reference with functional history, clipboard, insertion, font, alignment, page, and operations groups. Groups are content-sized and stay on one horizontal row; narrow surfaces scroll horizontally instead of wrapping. Undo/redo restores field snapshots, cut/copy/paste uses the template-field clipboard, format painter applies the complete field text style—including colors—to the next selected field, alignment changes both prompt and entered-value alignment, page controls toggle fit-width and rulers, and operations expose properties and clear-selection. Ribbon separators use a visible slate-gray boundary in light and dark themes. Noto and Liberation families are licensed under SIL OFL 1.1; PDF export embeds an available matching font, while DOCX records the selected family and relies on the document consumer's installed/bundled font support.

The final approved refinement removes visible group captions from the compact command bar while retaining a semantic toolbar label for assistive technology. The supplied SmartForm editor reference remains the visual basis for the template rail, title metadata, save controls, command surface, and document canvas.

The project-template library adopts the same approved left-rail composition: a title and item count, one primary creation action, compact search with a secondary import action, a restrained selection rail, status and content summary, and an overflow menu for settings and deletion. Project-template and SmartForm actions retain their domain-specific copy and behavior.

### SmartForm PDF audit-workpaper proposal (2026-09-04)

Status: `Approved for SmartForm product adoption — user approved the rendered EasyPaper direction on 2026-09-04`

SmartForm PDF export should read as a formal audit working paper for every definition accepted by the SmartForm V2 compiler, not as a generic report with template-specific decoration. The proposal uses a print-first A4 document system: a restrained document masthead, stable engagement metadata, compact evidence-led field rows, thin-rule data tables, quiet group bands, traceable working-paper references, and an archive-oriented footer. Section hierarchy is intentionally unnumbered because valid SmartForm templates may compose and nest sections freely. Each title establishes the content column for all explanatory text, nested sections, fields, and tables it owns. Top-level chapters use a strong divider, while nested sections rely on restrained indentation, type scale, weight, and spacing without repeated rules or decorative bands. Deeper legal nesting caps further indentation and repeats the third-level treatment instead of shrinking the text or usable content width indefinitely. The treatment is deliberately light, monochrome-first, and uses green only for positive or selected audit meaning. It avoids decorative cards, large empty bands, repeated status ornaments, undersized table text, and template-name-specific layout branches.

The contract covers every legal compiled node: section, group, content, field, conditional, fixed sheet, and repeatable sheet. It also covers choice, text, rich-text, attachment, reference, date, and number values; rich-text lists, quotations, embedded references, and tables; incomplete responses; long localized content; deeply nested hierarchy; active conditional branches; and tables continuing across pages. The audit-programme, mixed-field, rich-text, multi-page, multi-signoff, and English specimens at `/blocks#smart-form-pdf-workpaper` are the approved representative surfaces. Product adoption is implemented by `apps/api/src/smart-forms/smart-form-v2-pdf.service.ts` and the persisted sign-off/context loaders used by preview, archive, and project-file export paths.

The revised proposal uses the MIT-licensed Typst Universe package `@preview/easy-paper:0.2.2` as its pinned typesetting foundation. ProjectWing retains a narrow audit adapter for engagement metadata, review-anchor metadata, field/value layouts, conditional-arm selection, and SmartForm sheet semantics. The adapter maps the paper-author position below the title to two stable audit sign-off groups: preparers and approvers, with every person retaining an individual name and sign-off date. An unsigned group remains visible as pending and must never imply completed approval. Multiple people stack within their role group, are never collapsed behind a `+N` summary, and are not duplicated in a second sign-off table. The complete document-identity region—title, sign-offs, and engagement metadata—is followed by two body line-heights of whitespace before the first SmartForm node. Each top-level section adds one further body line-height of separation from the preceding section; nested section spacing remains compact. The adapter overrides EasyPaper's default visible heading numbering, first-line indentation, and academic running header while preserving its A4 proportions, Chinese/Latin typographic hierarchy, content rhythm, centered document identity, page numbering, and three-line table treatment. Production uses the open-source Noto CJK families installed in the API image; Windows development may use the installed Microsoft YaHei or SimHei display face before falling back to `Noto Sans SC`, while body copy uses `Noto Serif SC`. Document titles, section headings, table headers, field labels, signatory names, and sign-off roles use the regular sans face rather than a bold weight; hierarchy comes from size, spacing, alignment, and rules. Body copy and values use the coordinated serif face, while genuine inline semantic emphasis may still be bold. Fixed, repeatable, and rich-text tables must emit explicit column tracks and `table.header` content so EasyPaper can preserve repeating headers and page continuation. Muted print text uses a darker neutral range than the original proposal so sign-off roles, dates, metadata labels, descriptions, and incomplete values remain legible.

EMP system-administration surfaces use the shared `ProjectWingTopBar` and `EmpTopBarControls` instead of route-local legacy headers. User management uses the top-bar search for user lookup, retains a compact task summary in the content area, and keeps page-level horizontal overflow contained inside its data workbench.

### SmartForm conditional content proposal

Status: `Approved for SmartForm product adoption`

Approved by: User Approved at: 2026-08-28

The SmartForm condition pattern is a first-class AST node and domain-level E-shaped branch container inspired by Scratch control blocks without exposing programming-language concepts. Each condition owns one restricted branch question. Version one permits single-choice, multiple-choice, and numeric questions with type-appropriate comparisons. A condition contains an ordered list of up to eight conditional arms plus a default arm; runtime selects the first matching arm. Arms have stable internal IDs but no user-authored names because their question and trigger already provide the complete meaning and the product does not yet support branch references. Every arm accepts arbitrary SmartForm content, including nested conditional blocks, and an empty arm is explicit rather than visually ambiguous. For single-choice questions, an option may be assigned to only one arm. The user approved product adoption and explicitly rejected implementing the pattern as a collection of legacy `visibleWhen` expressions.

The E-shaped condition chrome is authoring-only. In fill and read-only modes, the branch question renders exactly like an ordinary question with no condition badge, warning container, or pending placeholder. The selected arm is revealed one spacing level (24px) inward and one content interval (20px) below the question so its dependency is legible without exposing the underlying conditional block.

In the authoring canvas, the condition remains intentionally quiet: a thin primary-colored logic rail, neutral condition token, and ordinary content surfaces. Warning-colored panels are not part of the resting state. Selection and Puck drag/drop affordances provide the high-contrast boundary only while the author is manipulating the block.

Every authoring-canvas block carries the same low-contrast type icon used by its toolbar command (section, static text, question, table, or condition). These icons are editor-only orientation aids and do not appear in fill or read-only output.

### Shared workbench consolidation (2026-09-05)

The user authorized autonomous refinement of common UI surfaces, guided by consistency, simplicity, detail and discoverable functionality. This pass adds `primaryAction` and `footer` composition slots to `ProjectWingMasterDataGrid`: primary commands stay visible when secondary actions overflow; custom pagination belongs inside the same frame as the table. Record counts are neutral and flexible-width. Pagination presents a bounded range around the current page, with first/last pages and labelled previous/next controls. `ProjectWingTopBarAvatar` gains a 24px `compact` size for dense identity rows. These remain experimental capabilities pending complete baseline readiness, with rendered evidence at `/specimens/DataWorkbench` and findings in `ui-consistency-review-2026-09-05.md`.

### Devices and density

The 2026-09-10 [touch-first EMP proposal](mobile-app-experience-proposal.md) reopens the phone interaction model without changing desktop density. It introduces opt-in experimental navigation, list and action-sheet samples at `/mobile` and `/specimens/MobileWorkspace`. It is not yet approved for product adoption; the existing desktop rules below remain in force.

The second autonomous consistency pass adds `ViewSwitcher`, a controlled, labelled compact alternative to a wide view/category rail, and `CollectionState` for localized loading, error, empty and filtered-result feedback. Retry is owned by the calling feature. In narrow workspaces, navigation must not consume a large share of the primary data area or hide the account/search entry. Wide rails and their user-selected widths remain available. Loading/error states must not be presented as a successful zero-item result. These additions are experimental and demonstrated at `/specimens/DataWorkbench`.

- EMP, CMP, and TMS are desktop-primary workbenches.
- Internal forms and navigation must remain usable at narrow widths.
- IB is responsive-first and uses the same foundations with a calmer default density.
- Shared components support named `compact` and `default` density behavior where density is a real capability.
- Product pages must not create private density systems through arbitrary class overrides.

Representative validation viewports are proposed as:

- 1440 × 900 for primary desktop workbenches;
- 1280 × 800 for constrained desktop and laptop layouts;
- 768 × 1024 for narrow internal workflows;
- 390 × 844 for external and essential responsive flows.

### Accessibility target

WCAG 2.2 AA is the proposed project target.

Every public interactive component must provide or require:

- an accessible name;
- visible keyboard focus;
- correct keyboard behavior and focus restoration;
- non-color state communication;
- label, description, error, and required relationships for fields;
- reduced-motion behavior;
- sufficient target size and contrast for its density mode;
- rendered keyboard and screen-reader-oriented verification evidence before `Ready` status.

## 2. Foundations

### Sustained interaction consolidation (2026-09-05)

Under the user's autonomous enterprise-UI request, shared grids now expose reversible column and selection controls, explicit Chinese/English control copy, keyboard row activation and honest loading states. Row activation must not intercept nested controls, modifier shortcuts, held keys or text composition. Column resets preserve sorting, filters and selected records; responsive defaults cannot override an explicit user visibility choice. A programmatic/zero-width layout measurement must not be treated as the user's collapsed-navigation preference.

Settings category navigation must remain available when its desktop sidebar is hidden. Shared settings retain desktop sizing while using viewport-margin bounds and a compact category selector on narrow screens. Search scope is visible as placeholder text as well as an accessible name. Addons are not independent buttons; disabled adjacent actions must not visually disable editable fields. Error states retain a recovery action and must not masquerade as empty data. These are compatible corrections and experimental pattern extensions, not blanket design-system approval. See `ui-sustained-review-2026-09-05.md` for reviewed routes and verification evidence.

Foundations are cross-system. Apps may select approved theme or density modes but must not redefine semantic roles privately.

### Color

2026-09-05 user-requested consolidation: `packages/ui/src/color-palette.css` owns the common light/dark palette. EMP, CMP, TMS and Intranet alias the same action, surface, text and state roles. Light mode uses WZ-family green `#007a3d`, cool low-chroma gray canvas and white work surfaces; dark mode uses restrained mint actions against charcoal surfaces. Authentication's unrelated orange action override is removed. File-format identities, avatar identity colors, document content and explicitly scoped editor palettes are not recolored indiscriminately.

`--success`, `--warning`, `--info` and `--destructive` are filled status colors; `*-foreground` is text on that filled background. `*-subtle` and `*-text` are a separate pair for quiet status labels and inline messages. Never put a filled foreground on a translucent or pale background. Existing Badge public variant names are preserved. Zero counts remain neutral; nonzero status labels retain their text/icon meaning. Verify the actual shared components at `/specimens/Color` (also linked from Foundations). Contrast-pair tests target 4.5:1 ordinary text and 3:1 identifying input/focus boundaries, not a claim of whole-application WCAG conformance. This is a compatible color/accessibility correction under the user's autonomous optimization request, not blanket design-system approval.

The public token vocabulary must cover:

- canvas and application background;
- default, raised, muted, and inset surfaces;
- primary, secondary, and muted text;
- default, strong, and interactive borders;
- primary, quiet, and destructive actions;
- focus ring and selection;
- informational, success, warning, destructive, and neutral statuses;
- overlay scrim;
- data visualization series and comparison states;
- document and spreadsheet selection states.

WZ green is reserved for primary action, focus, positive brand emphasis, and selected state where semantics remain clear. Neutral slate or navy surfaces carry most hierarchy. Status colors must not depend on hue alone.

Raw values may exist inside foundation implementation files. Product code consumes semantic tokens only.

### Typography

The proposed semantic roles are:

- `ui-sans`: controls, navigation, forms, tables, and general application copy;
- `editorial-serif`: authentication, formal communication, and selected document-oriented presentation;
- `document-sans`: rendered or authored business documents where predictable metrics matter;
- `document-cjk`: approved Chinese document fallback stack;
- `data-mono`: identifiers, codes, technical diagnostics, and fixed-width comparisons where needed.

The type scale must define compact labels, body, emphasized body, section heading, page heading, and display roles. Product code must not use a heading solely to restate a route or adjacent selection.

Line height and measure must support bilingual expansion and long professional content. Placeholder text is never a label.

### Spacing and density

- Use a 4 px base spacing rhythm expressed through semantic layout and component tokens.
- Prefer named gaps and padding roles over page-local numeric values.
- `compact` is intended for dense tables, grids, toolbars, and repeated workbench controls.
- `default` is intended for forms, dialogs, settings, knowledge, authentication, and external collaboration.
- Touch-oriented layouts may increase target size without creating a third visual vocabulary.

### Shape and borders

- The observed 0.625 rem base radius remains the proposed default family anchor.
- Control, container, and overlay radii derive from semantic radius tokens.
- Borders carry grouping before elevation does.
- Nested cards and card-like shadow surfaces inside cards are prohibited.
- Overlays must not contain decorative card shells when sections, separators, or field groups communicate the structure.

### Elevation

The system uses a small semantic elevation set:

- `flat`: normal page sections and data surfaces;
- `raised`: floating controls or surfaces requiring separation from canvas;
- `overlay`: popovers, menus, dialogs, and sheets;
- `feedback`: temporary toast or action feedback.

Elevation must have a semantic reason. Page-level hierarchy should not be built from arbitrary shadows.

### Motion

The existing timing concepts become the proposed shared roles:

- `fast`: 120 ms for local control feedback;
- `normal`: 160 ms for small state transitions;
- `panel`: 180 ms for panels and overlays;
- `feedback`: up to 1100 ms for temporary confirmation or highlight effects;
- `standard` easing: `cubic-bezier(0.2, 0, 0, 1)`;
- `emphasized` easing: `cubic-bezier(0.16, 1, 0.3, 1)`.

Reduced-motion mode must remove non-essential transforms and keyframes while preserving state and completion feedback.

### Icons and imagery

- `lucide-react` is the proposed standard icon source and a documented product integration exception during the initial contract.
- Default inline icon sizes are 16, 18, and 20 px, selected by component size rather than page preference.
- Icon-only controls require an accessible name and normally use the shared tooltip policy.
- Do not mix unrelated outline, filled, or branded icon systems in one control family.
- Brand and partner logos are assets, not substitutes for action icons.
- New decorative stock imagery requires explicit product or brand rationale.

### Breakpoints and containers

- Use the shared Tailwind breakpoint vocabulary unless the registry records a justified platform addition.
- Layout components own container width and responsive collapse behavior.
- Product components must not infer responsive behavior from a named page.
- Dense data may scroll or progressively disclose; it must not silently hide required information.

## 3. Component architecture

### Layers

The design system uses five registry layers:

1. `foundation`: semantic tokens and global interaction rules;
2. `primitive`: atomic public controls and layout building blocks;
3. `pattern`: reusable cross-page compositions;
4. `layout`: page and application structures;
5. `archetype`: reusable capabilities specific to professional workbench and evidence workflows.

Business-domain components may live outside the design system. They must compose public design-system APIs and may not expose an underlying UI library as their own contract.

### Status semantics

- `planned`: required or accepted into the roadmap, but not implemented as a verified public API;
- `experimental`: implementation exists or is being consolidated, but the complete public contract or evidence is not ready;
- `ready`: exported, registered, demonstrated, state-complete, accessible, tested, rendered, and validator-approved;
- `deprecated`: supported only for migration with a named replacement and removal plan.

No existing component is considered `ready` merely because it ships in a product app. Initial registry entries for existing implementations start as `experimental` until evidence passes.

Planning priority is recorded separately as `Required now`, `Planned`, or `Deferred`.

### Public component API rules

Every public component must:

- expose product-safe props and types through the public entry;
- hide third-party types, props, data attributes, and styling contracts;
- use consistent controlled and uncontrolled state names;
- emit semantic values rather than raw browser events when practical;
- forward safe native and accessibility attributes;
- forward refs to the expected semantic or interactive node;
- use semantic variants such as `primary`, `quiet`, `danger`, or `success`;
- distinguish disabled, read-only, loading, invalid, selected, active, and required states;
- preserve native form and keyboard behavior;
- keep business rules, persistence, and data fetching outside primitives;
- treat `className` as a secondary escape hatch rather than the variant API;
- use shared `Field` behavior for labels, descriptions, required indicators, and errors;
- define focus, Escape, outside interaction, scroll lock, and restoration behavior for overlays.

Repeated class overrides or Boolean prop combinations trigger the gap protocol instead of expanding page-local styling.

### Baseline capability plan

The machine registry will initialize from the DesignFirst 69-capability long-lived baseline. The following family view records ProjectWing planning intent without duplicating that canonical inventory.

| Capability family | Layer | Priority | Initial status | Public API target | Notes |
| --- | --- | --- | --- | --- | --- |
| Semantic colors, typography, spacing, shape, elevation, motion, icons, focus, and density | Foundation | Required now | Experimental | `@project-wing/ui` styles and theme exports | Existing app themes require consolidation and evidence |
| Surface, Container, Stack, Inline, Grid, Divider, ScrollArea | Primitive | Required now | Planned/Experimental | `@project-wing/ui` | Layout primitives must replace repeated page-local spacing contracts |
| Button, IconButton | Primitive | Required now | Ready | `@project-wing/ui` | Pilot approved on 2026-08-14; canonical variants are `primary`, `secondary`, `outline`, `quiet`, and `danger`; mainline shadcn names remain documented compatibility aliases while consumers migrate capability by capability |
| ButtonGroup, SplitButton, Link, Toggle families | Primitive | Required now | Planned | `@project-wing/ui` | Existing app wrappers remain transition sources until each capability completes its own evidence |
| Field, Input, TextArea, Search, Number, Select, Combobox, choice controls, date/time, file upload | Primitive | Required now | Experimental | `@project-wing/ui` | Preserve current Calendar policy while defining the public date capability |
| Tabs, breadcrumbs, menus, navigation, pagination, toolbar, command palette | Primitive/Pattern | Required now | Experimental | `@project-wing/ui` | Top-bar capabilities already exist; navigation families need consolidation |
| Card, status, avatar, list, table, tree, disclosure, description list | Primitive/Pattern | Required now | Experimental | `@project-wing/ui` | Dense table is not the same capability as spreadsheet behavior |
| Alert, toast, spinner, progress, skeleton, empty, error, permission denied | Primitive/Pattern | Required now | Experimental | `@project-wing/ui` | Feedback must preserve actionable recovery and announcements |
| Tooltip, popover, dialog, confirm dialog, drawer | Primitive | Required now | Experimental | `@project-wing/ui` | Focus and scroll behavior require real interaction evidence |
| App shell, headers, form/filter/data patterns, list/detail/form/settings layouts | Pattern/Layout | Required now | Experimental | `@project-wing/ui` | Existing cross-app implementations must be reconciled |

### ProjectWing archetype extension

The following reusable capabilities extend the universal baseline for a CPA operations workbench. Names are proposed public identities and may be refined before registry initialization.

| Capability | Layer | Priority | Initial status | Reuse scope |
| --- | --- | --- | --- | --- |
| `WorkbenchShell` | Archetype/Layout | Required now | Experimental | EMP, CMP, TMS |
| `DenseDataWorkbench` | Archetype/Pattern | Required now | Experimental | Client, engagement, project, timesheet, and query surfaces |
| `MasterDetailWorkspace` | Archetype/Layout | Required now | Experimental | Review, approval, knowledge, and document workflows |
| `WorkflowTree` | Archetype/Pattern | Required now | Experimental | Project workflow, folders, entities, and structured navigation |
| `ApprovalProgress` | Archetype/Pattern | Required now | Experimental | CMP acceptance, TMS approval, project lifecycle |
| `ChangeComparison` | Archetype/Pattern | Required now | Experimental | Master-data changes, versions, review, and approval evidence |
| `DocumentWorkspace` | Archetype/Layout | Required now | Experimental | Preview, metadata, annotation, and review composition |
| `FileLifecycleActions` | Archetype/Pattern | Required now | Experimental | Upload, replace, version, restore, export, archive, and Master actions |
| `ReviewThread` | Archetype/Pattern | Required now | Experimental | Review questions, replies, evidence references, and resolution |
| `AsyncJobProgress` | Archetype/Pattern | Required now | Experimental | Imports, exports, archive, preview, and background processing |
| `AuditTrailView` | Archetype/Pattern | Planned | Planned | Cross-system operational evidence |
| `ExternalRequestWorkspace` | Archetype/Layout | Deferred | Planned | IB request, upload, comment, and submission workflows |

No archetype component owns business permissions, status transitions, persistence, or domain calculations. It presents those inputs through stable public composition and accessibility contracts.

## 4. Public boundary

### Target dependency direction

```text
product route
  -> domain component
    -> @project-wing/ui public API
      -> approved implementation libraries
```

Specialized platform adapters may sit beside the design system when they encapsulate a non-general rendering engine:

```text
domain component
  -> specialized public adapter
    -> document, grid, graph, or editor engine
```

The specialized adapter must consume shared foundations and controls where applicable. It must not become a second general-purpose design system.

### Canonical locations

- Design-system source root: `packages/ui/src`
- Product-facing import path: `@project-wing/ui`
- Public stylesheet: `@project-wing/ui/styles.css`
- Public TypeScript entry: `packages/ui/src/index.ts`
- Human-readable contract: `docs/design-system.md`
- Machine-readable registry: `docs/design-system.registry.json` after initialization
- Generated implementation provenance: `docs/ui-provenance.generated.json`
- Discovery evidence: `docs/design-system-discovery.md`
- Boundary configuration: `design-first.boundary.json` after initialization
- Portable validators: `.design-first/` after initialization
- Proposed showroom root: `apps/ui-showroom`

An `approved` registry must record the SHA-256 digest of the exact current generated provenance inventory in `approval.provenanceHash`. A missing or stale digest invalidates the approval, so source drift cannot retain an older design decision silently.

### Hidden implementation dependencies

The target boundary hides general UI implementation packages, including:

- `@base-ui/react`;
- `@fluentui/react-components` and `@fluentui/react-icons` after Intranet migration;
- `motion` where behavior belongs to a public component or pattern;
- `sonner` behind public toast APIs;
- app-installed shadcn and registry implementation details.

Specialized engines such as TanStack Table, Glide Data Grid, XYFlow, EmbedPDF, document renderers, and editors must be used through named adapters or explicitly registered domain integration files.

### Documented integration exceptions

- `lucide-react` may be imported by product and domain components during the initial system phase as the standard icon source. Components still own icon size, placement, accessible naming, and interaction behavior.
- Top-level provider, global CSS, worker, and engine setup files may import an underlying package when required by framework integration.
- Tests may import implementation-specific helpers when they verify the wrapper contract rather than teach product code to bypass it.

These are proposed exceptions, not approved registry exceptions.

### Transitional app-local boundary

Existing app-local `src/components/ui` and approved registry wrapper directories remain a transitional public surface because product code already depends on them and the repository's shadcn workflow installs there.

During transition:

- existing imports may remain unless the touched capability is being consolidated;
- new cross-system primitives and patterns must target `@project-wing/ui`;
- a capability must not be implemented independently in another app without a registry decision;
- app-local wrappers may import Base UI only where the existing guardrail permits it;
- product files may not start importing Base UI directly;
- a migrated capability receives a public export, showroom evidence, compatibility plan, and consumer migration before its local wrapper is deprecated.

### Specialized public packages

`@project-wing/document-viewer` and other specialized UI packages may remain separate public adapters when they encapsulate a substantial engine and do not expose a competing primitive vocabulary. Their chrome, actions, feedback, and layout integration must use the ProjectWing system.

### Enforcement ownership

No CODEOWNERS file currently assigns named maintainers. Until ownership is formalized, role ownership is proposed as:

| Area | Proposed owner role |
| --- | --- |
| Public exports and component APIs | UI platform maintainers |
| Foundations and theme compatibility | UI platform maintainers |
| Domain components | Owning app maintainers |
| Registry and showroom evidence | UI platform maintainers with app reviewers |
| Boundary configuration and CI | Repository maintainers |
| Exceptions | Repository maintainer plus affected app owner |

The next enforcement phase must not make a check required until these responsibilities are accepted operationally.

## 5. Showcase contract

The proposed showroom is a dedicated development-only workspace app rather than an EMP product page.

- Proposed package: `@project-wing/ui-showroom`
- Proposed source root: `apps/ui-showroom`
- Proposed local command: `corepack pnpm --filter @project-wing/ui-showroom dev`
- Proposed local URL: `http://localhost:3008`
- Deployment: none by default; CI builds and renders it as verification evidence

The default route must be a catalog overview generated from or reconciled with the registry. It must lead to stable pages for:

1. foundations;
2. layout primitives;
3. action and form controls;
4. navigation and commands;
5. data and content display;
6. feedback and overlays;
7. cross-page patterns and layouts;
8. ProjectWing archetype capabilities;
9. one or two integration specimens after the component catalog.

Each public family must show applicable variants, sizes, default, focus, active, selected, disabled, read-only, loading, invalid, empty, error, destructive, long-text, bilingual, dense, and narrow-width states. Interactive families require real keyboard and focus verification.

Showcase chrome may use narrowly scoped documentation-only styling. Demonstration canvases and product-like specimens must use the same public API and boundary rules as product code.

Screenshot and rendered evidence paths will be recorded in the registry. No screenshot location is approved or created by this contract.

## 6. Decisions and status

| Decision | Status | Evidence or rationale |
| --- | --- | --- |
| Work classification and product scale | Proposed | Repository discovery identifies an existing inconsistent, long-lived, multi-app product |
| Visual direction | Proposed | Existing brand assets, semantic themes, and professional workbench requirements |
| Accessibility target | Proposed | Existing accessible-name and interactive verification rules; WCAG 2.2 AA requires explicit adoption |
| Foundations | Proposed | Existing green/slate/navy themes need consolidation and showroom evidence |
| Canonical public entry | Proposed | `@project-wing/ui` already exists and is consumed by internal apps |
| Transitional app-local wrappers | Proposed | Required to avoid a disruptive rewrite while converging public capabilities |
| Specialized adapter boundary | Proposed | Document, grid, graph, and editor engines are not general primitives |
| Lucide integration exception | Proposed | Existing approved icon source with 133 non-test source consumers |
| Archetype extension | Proposed | Repeated workbench, evidence, review, approval, document, and file workflows |
| Dedicated showroom app | Proposed | Keeps evidence independent from product auth, routing, and domain data |
| Design system approval | Proposed | Cannot advance until the showroom is rendered, inspected, and explicitly approved |

## 7. Proposed exceptions

No exception is approved by this document. The following proposals must be represented in the registry and reviewed before initial system approval.

| Scope | Reason | Future cost | Proposed disposition | Owner | Review point |
| --- | --- | --- | --- | --- | --- |
| Existing app-local `src/components/ui` wrappers | Current product code and shadcn workflows depend on them | Duplicate APIs and app drift continue until consolidation | Deferred migration | UI platform and app maintainers | Every capability migration and initial showroom approval |
| Existing Intranet Fluent UI integration | Intranet predates the target shared boundary | Continued visual and API divergence | Deferred migration | Intranet maintainers | Before Intranet is included in strict boundary enforcement |
| Direct `lucide-react` product imports | Existing approved icon source with broad usage | Icon rules remain convention-based without an adapter | Proposed permanent integration exception | UI platform maintainers | Initial showroom approval |
| Specialized document, grid, graph, and editor engines | Capabilities exceed general primitive scope | Poor adapters can leak engine APIs and styling | Permanent only through named adapters | Owning package and app maintainers | Adapter registration and each new engine introduction |
| Existing `scripts/ui-stack-baseline.json` findings | Historical debt is already frozen by fingerprint and count | Debt remains until touched or scheduled migration | Deferred, never an allowlist for new debt | Repository and app maintainers | Touched-file work and quarterly governance review |

User approval, approver identity, timestamp, and any permanent or deferred disposition will be recorded only after the user has seen the showroom evidence and the exact cost of each exception.

## 8. Change and gap policy

Before a product team creates or changes reusable UI:

1. Search the public exports, registry, showroom, transitional wrappers, and existing domain patterns.
2. Decide whether the need is a primitive, pattern, layout, archetype capability, or genuine domain component.
3. Extend the smallest correct layer without exposing business rules or third-party APIs.
4. Add or update the registry entry and public export.
5. Demonstrate required states in the showroom.
6. Add type, behavior, accessibility, responsive, and visual evidence.
7. Run registry, boundary, repository, and rendered verification.
8. Request renewed approval only when the change materially alters the approved visual language or interaction model.

Small compatible fixes follow the approved contract and do not require a new design phase. Material token, public API, layout, interaction-model, boundary, or approval changes require governance review.

## 9. Initial enforcement posture

- Preserve `scripts/ui-stack-guardrails.mjs` as the repository UI enforcement entrypoint.
- Initialize DesignFirst portable validation without adding a competing GitHub Actions workflow.
- Start DesignFirst boundary reporting against historical code without making the report a required check.
- Make registry validity required before strict product boundary enforcement.
- Protect new and touched UI before expanding to untouched legacy files.
- Do not update historical baselines merely to make new code pass.
- Do not declare the design system approved or any capability ready before rendered evidence exists.

### Bright harmony refinement

The user approved a revised project-wide direction: light neutral structure with vivid, deliberately limited functional color, not universally desaturated brown/gray-blue. Content and table bodies use `card`; ordinary text is neutral charcoal. Graphic `*-accent` roles and their readable `*-accent-foreground` roles are distinct from small status-text colors. Routine status uses neutral labels with vivid dots/icons on subtle surfaces. The customer requires P green and R orange; shared `success` and `warning` buttons preserve this as small vivid fills, not a completion assertion. HTML and canvas grids share canonical palette roles. See `ui-bright-harmony-review.md` for the palette, reference and verification; this does not broaden the registry's approval state.

### Narrow viewport contracts

The experimental mobile Web workspace has an opt-in neutral appearance in `packages/ui/src/mobile-color-palette.css`. Its mounted routes apply `pw-mobile-theme` to the document so portaled menus share the same palette; they restore the previous appearance on exit. Light surfaces are white/gray, dark surfaces are neutral charcoal, and primary actions are monochrome. Green is reserved for the active mobile navigation and semantic success, not every control. Error/warning/info roles remain semantic. This is a user-directed Codex-like visual direction, not a claim to reproduce an official Codex palette. Desktop enterprise tokens are unchanged. Both mobile workspace and mobile project creation use the same stored appearance preferences. The work remains experimental and is not a production-wide mobile rollout.

The user approved schema-driven SmartForm mobile translation on 2026-09-11, superseding the earlier table-only phone preview. Mobile records preserve source row/column identity and grouped headers, reuse real field controls, and honor explicit comparison-table presentation. Subsequent user direction removes disclosure controls on phones: all applicable content remains expanded and left-aligned. Desktop disclosure remains intact. This is an experimental domain renderer, not a new global visual language. See `smart-form-mobile-projection.md` for scope and verification.

The same review subsequently approved a compact mobile SmartForm header, native-sans typography with semantic color accents, unframed field values and bottom-sheet selection/input (including rich text, block formatting and links). More contains low-frequency language/reset actions. This supersedes the earlier inline mobile rich-text editing proposal; desktop behavior remains unchanged. The shared sheet handles visual-viewport keyboard insets and reduced motion.

Priority top-bar search moves to its own row below 768px; brand text may collapse to its accessible mark, but return and quick actions must remain reachable. Data-heavy tables preserve useful minimum column widths inside named scroll regions, never by expanding the page or reducing text to fit. Compact project workspaces use one selected pane and restore desktop layout preferences. Preview split panes may stack, and document toolbar groups wrap independently of the browser width. Dialogs remain within dynamic viewport bounds, including short landscape windows. These changes remain experimental under the current registry approval posture; evidence and limitations are in `ui-responsive-review-2026-09-05.md`.
