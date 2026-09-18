# Sustained enterprise UI review — 2026-09-05

Status: sustained work window completed; subsequent narrow-screen expansion implemented and locally validated. See `ui-responsive-review-2026-09-05.md` for coverage and unverified cases.

The user requested autonomous computer-use UI optimization for at least two hours. Start: **2026-09-05 02:33:49 UTC** (10:33:49 Asia/Shanghai). Do not consider the requested work window complete before **04:33:49 UTC**. This is a current-session work log, not a scheduled automation.

Worktree: `.worktrees/saas-ui-consistency-pass`, branch `codex/saas-ui-consistency-pass`. Earlier UI and color-pass changes are retained. No PR, merge, deployment, account mutation, invitation, project creation, file restoration or native settings update is authorized as part of visual inspection.

## Priorities and reference

Use the supplied ServiceNow reference and [Horizon workspace structure](https://horizon.servicenow.com/workspace/basics/structure) as context for stable navigation, distinct list/record tasks and clear contextual actions. Preserve ProjectWing's shared green/neutral visual language. Consolidate common primitives before page-specific refinements; do not invent dashboards or metrics.

## Implemented batches

1. **Shared grid correctness and recovery.** Removed status-color overrides hidden inside the shared grid, CMP client grid and project-file frame. Clickable rows support Enter/Space with visible focus, without intercepting nested input/button behavior, IME composition or modifier shortcuts. Nonselectable rows expose disabled selection controls. Added explicit cancel-selection and restore-default-column actions; restoring columns retains sorting, filtering and selected records. Compact defaults no longer override explicit column choices. Shared table control copy supports an explicit Chinese/English locale.
2. **Search affordance and feedback.** Shared top-bar search now shows its scope as placeholder text and has a visible focus treatment. EMP project search remains available in narrow layouts and has a named clear action. Desktop and project-recycle-bin request failures are no longer presented as empty content, and expose retry without enabling restore actions. Recycle-bin metadata retains all fields but removes a separate box around every value.
3. **Project source selection.** CMP engagement rows can be selected by keyboard, retain focus in the search field after results collapse and expose a clear "choose another" action. This does not create a project or resolve/persist its code.
4. **Settings and field behavior.** Shared settings navigation uses a compact selector below the desktop breakpoint; mobile dialog bounds retain a small viewport margin. Settings rows stack instead of overflowing a fixed three-column grid. Input addons are not phantom buttons and do not capture a nested save action's keyboard events. A disabled save button no longer dims its editable input. Cache settings show connection errors inline with retry, and Enter obeys the same save eligibility as the button.
5. **Responsive project navigation.** The project folder sidebar has a compact folder selector and no orphan resize handle below 768px. The resizable-panel API collapses the hidden panel rather than leaving its outer flex allocation behind. Desktop width preferences are retained and restored when returning to a wide viewport.

## Browser evidence so far

- Authenticated development API, via existing localhost proxies. Only read/navigation and local view-state actions were used.
- EMP `/zh-CN/engagement/new`: searched Orchid and selected `ORC-2026-AUD` with Enter. Related client/PIC/MIC summary appeared; no creation was submitted.
- Project list: keyboard-opened column settings, used arrows to show System ID, used End/Enter to restore defaults, and Escape returned focus to the trigger. Selected folder changes affect only the current view, not placement records.
- Actual 480px-wide EMP: folder selector is present, sidebar allocation is 0px and content is approximately 456px wide. Switching to an empty folder shows its true empty state and disables select-all. Settings dialog measures approximately 464px wide without horizontal overflow; category selector is reachable.
- Cache field: before correction the input was enabled and Save disabled, but the entire group had computed opacity `0.5`. After correction the input remains enabled, Save remains disabled and group opacity is `1`.
- Browser viewport overrides apply when the tested tab is visually presented. The current environment clamps the tested minimum to 480 CSS pixels; 390px acceptance is not claimed. Temporary overrides must be reset before handoff.
- Settings and data-workbench specimens demonstrate actual shared components. Screenshots are captured inline in the task; detailed final commands/results will be recorded after the final validation pass.

## Verification notes

Initial tests exposed an English/Chinese mismatch in the CMP test harness (Chinese locale paired with an English fallback dictionary). The client-grid tests now mount an explicit English provider and assert English route prefixes. Sort-label tests now assert the expanded labels instead of `Asc`/`Desc`; desktop sizing assertions remain intact while mobile bounds and semantic borders are covered. No workflow assertions were weakened to hide the three unrelated pre-existing CMP/TMS regression failures recorded in the preceding color review.

The requested two-hour minimum was exceeded: work continued from 02:33:49 UTC through at least 05:50:43 UTC (3h 16m 54s). Final narrow-screen checks and their exact commands are recorded in `ui-responsive-review-2026-09-05.md`. No PR, merge or deployment was performed.
