# Component API contract

Apply this contract to every public design-system component. Prefer consistent, composable APIs over page-specific convenience props.

## Contents

1. Public surface
2. Naming and value models
3. Native behavior and refs
4. Composition
5. Variants and layout
6. State semantics
7. Form controls
8. Overlays and menus
9. Async behavior
10. Styling escape hatches
11. Accessibility
12. API review checklist

## 1. Public surface

- Export product-safe APIs from one documented design-system entry point.
- Keep third-party component types, prop names, data attributes, and styling contracts private.
- Export public prop and value types when consumers need them.
- Do not expose internal implementation components merely to simplify a single page.
- Keep public APIs stable enough that the underlying UI library can be replaced without rewriting product screens.

## 2. Naming and value models

Use consistent names:

- `value` for controlled state;
- `defaultValue` for initial uncontrolled state;
- `onValueChange(nextValue)` for semantic value changes;
- `open`, `defaultOpen`, and `onOpenChange(nextOpen)` for disclosure state;
- `checked`, `defaultChecked`, and `onCheckedChange(nextChecked)` for boolean selection;
- `selectedKeys` or another documented collection model for multi-selection;
- `disabled`, `readOnly`, `required`, `invalid`, and `loading` only with their standard meanings;
- `size` for supported control sizes;
- `variant` or a semantic equivalent for visual intent.

Do not mix controlled and uncontrolled ownership. Do not silently copy a controlled value into internal state. Document whether a component supports controlled, uncontrolled, or stateless use.

Emit semantic values rather than raw browser events unless the event itself is part of the public contract. Allow native event handlers to pass through when consumers reasonably need them.

## 3. Native behavior and refs

- Prefer the correct native element and behavior before recreating it with generic elements.
- Forward refs to the primary interactive or semantic DOM node when the framework supports refs.
- Forward safe native attributes, `data-*`, and `aria-*` attributes.
- Preserve native form behavior, including name, value, required, disabled, and form submission semantics where applicable.
- Do not replace native keyboard behavior without implementing an accessible equivalent.
- Document any component whose primary ref does not target the expected DOM node.

## 4. Composition

- Prefer children, slots, and compound components for structural composition.
- Prefer a small semantic variant API for stable visual choices.
- Do not add page nouns as primitive props, such as `isBillingPage` or `ticketMode`.
- Do not create large Boolean prop matrices. When multiple Boolean props describe structural alternatives, use slots, variants, or separate patterns.
- Keep business rules and persistence outside the design system.
- Allow domain components to compose public primitives without exposing underlying-library APIs.

For compound components, define ownership of state, context, focus, labeling, and item registration. Keep subcomponents namespaced or otherwise clearly related.

## 5. Variants and layout

- Name variants by intent, such as `primary`, `secondary`, `quiet`, `danger`, or `success`.
- Do not name variants after raw colors or individual pages.
- Keep size names consistent across related controls.
- Keep external layout responsibility with layout primitives and parent compositions.
- Do not add arbitrary margin props to every component.
- Allow full-width or alignment props only when they represent a stable component capability.
- Use semantic tokens for every public visual decision.

## 6. State semantics

Treat these states as distinct:

- `disabled`: not actionable and normally excluded from interaction;
- `readOnly`: perceivable and focusable when useful, but not editable;
- `loading`: an operation is in progress; prevent duplicate actions when necessary;
- `invalid`: current value failed validation and is associated with an explanation;
- `selected` or `checked`: current choice state;
- `active` or `pressed`: current interaction state, not a substitute for selection;
- `required`: input is required but not automatically invalid before validation.

Do not communicate state through color alone. Preserve labels, icons, text, and accessible state attributes.

## 7. Form controls

- Use a shared `Field` contract for label, description, required indicator, validation message, and ID relationships.
- Associate labels, descriptions, and errors programmatically.
- Define validation ownership: the component displays validation state but does not invent business validation rules.
- Support disabled and read-only behavior consistently.
- Keep placeholder text supplemental; never use it as the only label.
- Define empty values and clearing behavior consistently.
- Avoid returning multiple incompatible value shapes for controls in the same family.

## 8. Overlays and menus

- Use controlled/uncontrolled open-state conventions.
- Define trigger, content, title, description, close, and action slots as appropriate.
- Manage initial focus, focus trapping for modal content, Escape behavior, outside interaction, and focus restoration.
- Centralize portals, stacking layers, and scroll locking through platform policy.
- Preserve keyboard navigation and typeahead behavior for menus and selection lists.
- Require accessible names for icon-only triggers.
- Do not put essential information only in a tooltip.

## 9. Async behavior

- Prevent duplicate activation when an action is loading if duplicate execution would be unsafe.
- Preserve the control's accessible name while showing loading state.
- Announce meaningful async completion or failure through the appropriate feedback pattern.
- Do not make primitives perform product data fetching or persistence.
- Keep retry, optimistic state, and error recovery in a pattern or product layer unless universally reusable.

## 10. Styling escape hatches

- Keep `className` or the framework equivalent optional and secondary.
- Do not make consumer-supplied classes the normal way to select variants, sizes, spacing, or states.
- Do not expose internal class names as a public contract.
- Restrict inline `style` to legitimate dynamic values that tokens and variants cannot express, such as measured position or progress percentage.
- Reject raw colors, arbitrary radii, shadows, and typography overrides in product usage.
- Prefer semantic slots or component variants when the same override appears more than once.

## 11. Accessibility

- Define an accessible name requirement for every interactive component.
- Use correct roles, states, properties, and relationships.
- Provide visible focus and meaningful keyboard order.
- Meet the project's target size and contrast requirements.
- Preserve reduced-motion behavior.
- Support screen-reader announcements for dynamic feedback where required.
- Test real keyboard behavior; do not infer accessibility from markup alone.

## 12. API review checklist

Before marking a public component `Ready`, verify:

- controlled and uncontrolled ownership is explicit;
- prop, event, and state names follow this contract;
- native attributes and refs behave predictably;
- business and page-specific props are absent;
- variants are semantic and finite;
- composition avoids Boolean prop explosion;
- disabled, read-only, loading, invalid, and selection semantics are distinct;
- styling escape hatches cannot replace normal design-system usage;
- accessibility behavior is implemented and tested;
- the showroom documents the supported public contract.
