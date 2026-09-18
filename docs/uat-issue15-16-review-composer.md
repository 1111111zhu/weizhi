# Issues 15–16: review-note links and mention avatars

The link button previously used a browser prompt and only applied a link mark to the selection, so an empty selection inserted no visible link. The composer now opens the application's dialog with Display text and Link address, saves the selection before focus moves, and inserts a linked text node at that range. Empty display text uses the normalized URL. Existing links can be edited or removed. Cancel preserves the document. HTTP/HTTPS addresses are validated and bare domains default to HTTPS.

Mention suggestions now reuse `ProjectWingTopBarAvatar`, including the standard name-derived palette and initials, rather than a single initial on a hard-coded green background.

## Verification

- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/review-note-rich-text.test.tsx`: 9 passed. Includes named-link insertion with persisted Markdown, selected text replacement, cancellation, unsafe URL rejection, standard initials and mention insertion.
- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-review-notes-panel.test.tsx`: 7 passed.
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- `oxfmt apps/emp/src/components/review-note-rich-text.tsx apps/emp/src/components/review-note-rich-text.test.tsx apps/emp/src/i18n/dictionaries.ts --check --config oxfmt.config.ts`: passed with Node 24.
- `git diff --check`: passed.

Interactive environment: local mock EMP at `http://127.0.0.1:3033/zh-CN/engagement/project-orchid-2026`. Opened the notes for Cash current year lead schedule.xlsx, then Link. Entered display text and address, confirmed with Enter, and verified the actual DOM contained:

```text
textbox "消息":
  paragraph:
    link "审计参考资料":
      /url: https://example.com/audit
button "发送"
```

Opened Mention members and verified standard avatar elements for Jony Ma (JM), Leo Li (LL), and Sam Lu (SL), with the member names and roles preserved. Browser DOM/accessibility snapshots provide the interactive evidence; screenshot capture did not reliably retain the active modal state.

The browser check stopped at the composed draft; no message was sent. No authenticated backend persistence flow or deployment was performed. Markdown serialization is covered by the composer tests.
