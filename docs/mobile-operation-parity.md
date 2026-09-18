# EMP mobile operation parity

Requirement confirmed by the user: **all operations must remain available, implemented through mobile-appropriate interaction**. Smaller viewport size is neither authorization nor permission to remove a feature. This document is an acceptance checklist, not a completion report.

## Guarded source contracts

`apps/emp/src/lib/mobile-operation-parity.ts` maps every current callback in `WorkbenchDirectoryProps` and `WorkbenchContentProps`, every `WorkbenchSearchFileAction`, and every shared `ProjectPermissionAction` to a proposed mobile interaction. Exhaustive TypeScript records fail when those contracts add an unmapped action. Legacy role predicates are explicitly authorization-only, not phantom menu items.

This guards those source contracts only. It does **not** prove all product actions are connected; nested menus, template authoring, confirmation workflows and administrative pages need their own detailed inventory and runtime acceptance before parity is complete.

## Required coverage

| Area / source | Operations that must be retained | Mobile interaction | Current evidence |
| --- | --- | --- | --- |
| Projects — `views/projects.tsx`, `views/new-project.tsx` | Find, filter, create, edit metadata, choose template, roll forward, placement/folder management | Search, full-page steps, destination picker | Navigation/search sample only; business flows pending |
| Directory — `components/workbench-directory.tsx` | Add, rename, delete, locate, copy/move folders and files, upload, export, temporary/permanent bucket switch, clipboard, multi-select | Hierarchical views, explicit selection mode, destination sheets, confirmations | Hierarchy and local move sample; production callbacks pending |
| File/workpaper — `components/workbench-content.tsx`, `workbench-paper-section.tsx` | Create, placeholder, import, preview, new-window preview, download/export, replace, copy/cut/paste/move/delete, history and applicable version actions | File detail, explicit overflow menu, file picker, batch bar and version view | Read/layout, local sample selection/move only |
| Office/Master — `workbench-search-file-actions.tsx`, Desktop Agent settings | Open Master and complete the editing/check-in/recovery workflow, rather than just displaying an unreachable command | Capability-based mobile flow; retain clear completion and recovery paths | **Unresolved integration dependency**; no claim that the Windows Agent runs on a phone |
| Notes — `workbench-paper-section.tsx` | Create/assign/reply/resolve/reopen, mentions, rich text, attachments, working-paper references, multiple Qs | Question list, contextual conversation, editor and resource picker | Scoped Q1/Q2/Q3 replies/drafts and attachment-return sample; rich-text upload/API integration pending |
| SmartForm and templates — `components/extend`, template routes | Existing fill, row/column operations, validation, authoring, conditions, save and publication workflows | Schema-driven flat mobile records with real field controls; explicitly declared comparison tables retain scrolling | 3047 retains the canonical PDF snapshot. 3048 real EMP preview translates fixed-row sheets for both reading and filling, preserves grouped headers/IDs/visibility and removes phone disclosure controls. Mixed-schema fixture saves and responsive behavior were verified. Repeatable-row integration, live persistence, authoring and full device acceptance remain pending; see `smart-form-mobile-projection.md` |
| Signoff — shared permission actions and workpaper controls | Prepare, review and authorized revoke paths, including reasons/history | P/R on the file metadata row; bottom-sheet details and confirmation | Local preview P/R records, self-review confirmation, cooldown and revoke history implemented. Real attachment/workpaper API binding, version hashes, transactional checks and audit logs remain pending; not production signoff parity |
| Members — `views/members.tsx` | Invite/accept/cancel, remove, permitted role changes, PIC/MIC assignment, PIC recovery invitations and reauthorization, independence status | Member detail pages and controlled forms | Planned; reuse current authorization rules |
| Archive/recycle — `views/workbench-settings-panel.tsx`, workspace dialogs | Submit archive, final review, return/reopen, export, delete/restore, recycle-bin and temporary-file operations | Ordered review/checklist, typed confirmation where applicable, recovery views | Planned |
| Tasks/activity/audit — `views/inbox.tsx`, workbench activity/audit panels | Locate exact target, read/unread, process items, view history and logs | Actionable list → exact target → return to original position | Local contextual task sample only |
| Confirmations — `views/confirmations.tsx`, `components/confirmations` | Current create/import/template/fill/send/response/match/difference/export actions permitted to the actor | Step-by-step form, evidence detail, selection/action sheets | Local list/search/project/status filters, exact detail, create/edit draft, retained unsaved input and return context verified. Real API schema, permission checks, templates, sending and receipt processing remain pending. |
| Account/settings/admin — `views/admin-users.tsx`, `roles.tsx`, integration/settings components | Current account, settings, integration, user/grade/status and administrator workflows | Hierarchical settings and full-page forms | EMP global and workbench settings now opt into shared list/detail navigation while retaining actual panels, permission-derived inventory and callbacks. 39 EMP regressions pass. Showroom navigation, focus, resize/draft retention verified; isolated backend startup was blocked, so logged-in business acceptance remains pending. Standalone mobile preview adds matching global categories; service controls remain unavailable there and must not count as completed integrations. Other admin pages remain pending. |

## Definition of done for each operation

Use the recurring [walkthrough working loop and findings log](mobile-walkthrough-log.md). Each UI iteration must include a continuous user-task walkthrough, friction findings and re-verification of the changed path, not only isolated click assertions.

1. A discoverable touch/keyboard-accessible entry; no hover-only or gesture-only access.
2. The same business operation and current authorization checks as desktop, including read-only, stale membership and archive restrictions.
3. Correct object identity, full form/selection, validation, confirmation, persistence, error/retry and return navigation.
4. Context and draft preservation; no silent cross-project/file/question reuse.
5. Real backend-attached browser acceptance and device checks where platform behavior matters.
6. Evidence for the happy path and denied/interrupted path. A placeholder button, local fixture mutation, or mock screenshot is not completed parity.

No operation is declared unnecessary on mobile by this checklist. Any technical incompatibility requires an explicit equivalent workflow/design decision, not a hidden button or a false success message. Until all applicable rows are wired and verified, delivery remains a prototype/partial adaptation, not a complete mobile version.
