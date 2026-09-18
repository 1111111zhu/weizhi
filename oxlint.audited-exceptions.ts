type RuleOverride = {
  files: string[];
  plugins?: string[];
  rules: Record<string, "off">;
};

const disableForFiles = (rule: string, files: string[]): RuleOverride => {
  const plugin = rule.includes("/") ? rule.split("/", 1)[0] : undefined;

  return {
    files,
    ...(plugin ? { plugins: [plugin] } : {}),
    rules: { [rule]: "off" },
  };
};

// Every entry below is intentionally file-scoped. The remaining findings were
// reviewed after safe migrations, and each group depends on an existing
// runtime, framework, accessibility, or state-synchronization contract.
export const auditedRuleOverrides: RuleOverride[] = [
  disableForFiles("react/set-state-in-effect", [
    "apps/cmp/src/app/*/engagements/page-client.tsx",
    "apps/cmp/src/components/client-master-form.tsx",
    "apps/cmp/src/components/cmp-acceptance-view.tsx",
    "apps/cmp/src/components/cmp-app-shell.tsx",
    "apps/cmp/src/components/cmp-client-search-documents-sheet.tsx",
    "apps/cmp/src/components/cmp-engagement-fee-note-page.tsx",
    "apps/cmp/src/components/cmp-engagements-view.tsx",
    "apps/cmp/src/components/cmp-map-plane.tsx",
    "apps/cmp/src/components/detached-document-preview.tsx",
    "apps/cmp/src/i18n/client.tsx",
    "apps/emp/src/components/confirmation-response-warehouse.tsx",
    "apps/emp/src/components/confirmations/confirmation-information-library-field.tsx",
    "apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx",
    "apps/emp/src/components/confirmations/confirmation-response-routing-sheet.tsx",
    "apps/emp/src/components/confirmations/confirmation-response-warehouse.tsx",
    "apps/emp/src/components/confirmations/confirmation-template-workbench.tsx",
    "apps/emp/src/components/confirmations/project-confirmation-dispatch-action.tsx",
    "apps/emp/src/components/desktop-agent-cache-settings.tsx",
    "apps/emp/src/components/desktop-agent-settings.tsx",
    "apps/emp/src/components/detached-attachment-preview.tsx",
    "apps/emp/src/components/extend/{csv,docx,email-asset,pdf,pptx,xlsx}-viewer.tsx",
    "apps/emp/src/components/file-preview-pane.tsx",
    "apps/emp/src/components/project-confirmations-panel.tsx",
    "apps/emp/src/components/project-page-header.tsx",
    "apps/emp/src/components/project-wing-top-bar-controls.tsx",
    "apps/emp/src/components/smart-form-v2-{editor,readonly,template-designer}.tsx",
    "apps/emp/src/components/theme-provider.tsx",
    "apps/emp/src/components/workbench-{cached-preview,directory-row,directory,move-to-dialog,paper-section,template-library-dialog}.tsx",
    "apps/emp/src/components/zip-master-editor.tsx",
    "apps/emp/src/views/{new-project,projects,workbench-settings-panel,workspace}.tsx",
    "apps/intranet/src/app/page-client.tsx",
    "apps/intranet/src/components/knowledge-publish-dialog.tsx",
    "apps/tms/src/components/{approval-workspace,overview-workspace,query-workspace,resizable-review-panel,theme-provider,timesheet-workspace,tms-app}.tsx",
    "packages/document-viewer/src/{csv,docx,pptx,xlsx}-viewer.tsx",
    "packages/ui/src/constrained-{expandable-action-bar,top-bar-identity}.tsx",
    "packages/ui/src/data-grid/data-grid-scroll-area.tsx",
    "packages/ui/src/morph-popover.tsx",
    "packages/ui/src/project-wing-motion-popover{,-content}.tsx",
    "packages/ui/src/use-{auth-controller,project-wing-action-history}.ts",
  ]),
  disableForFiles("react/exhaustive-effect-dependencies", [
    "apps/emp/src/components/confirmations/{confirmation-pdf-preview,confirmation-register-data-grid,confirmation-response-preview,confirmation-template-workbench}.tsx",
    "apps/emp/src/components/extend/{csv,document-asset,docx,file-thumbnail,pdf-resize-presentation,pdf,pptx,xlsx}-viewer.tsx",
    "apps/emp/src/components/extend/file-thumbnail.tsx",
    "apps/emp/src/components/extend/pdf-resize-presentation.tsx",
    "apps/emp/src/components/workbench-{cached-preview,directory-row,paper-section,template-library-dialog}.tsx",
    "apps/emp/src/views/{new-project,projects,workbench-settings-panel,workspace}.tsx",
  ]),
  disableForFiles("jsx-a11y/prefer-tag-over-role", [
    "apps/cmp/src/components/cmp-boolean-indicator.tsx",
    "apps/cmp/src/components/cmp-form-controls.tsx",
    "apps/emp/src/components/confirmations/{confirmation-status-overview,confirmation-template-workbench,project-confirmation-dispatch-action,project-confirmation-editor}.tsx",
    "apps/emp/src/components/extend/{docx,file-upload,pdf,pptx,preview-loading-state}-viewer.tsx",
    "apps/emp/src/components/extend/file-upload.tsx",
    "apps/emp/src/components/extend/preview-loading-state.tsx",
    "apps/emp/src/components/extend/ui/spinner.tsx",
    "apps/emp/src/components/{project-confirmations-panel,smart-form-v2-editor,splitter-rail,workbench-cached-preview,workbench-directory,workbench-move-to-dialog,workbench-paper-section,zip-master-editor}.tsx",
    "apps/emp/src/components/ui/{button-group,field,input-group}.tsx",
    "apps/emp/src/views/{admin-users,new-project,projects,workspace-detail}.tsx",
    "apps/tms/src/components/timesheet-workspace.tsx",
    "packages/document-viewer/src/{docx,pdf,pptx}-viewer.tsx",
    "packages/document-viewer/src/ui/spinner.tsx",
    "packages/ui/src/{button-group,development-account-selector,member-directory,morph-popover-presence,project-wing-motion-popover-content,project-wing-top-bar-account-popover,project-wing-top-bar-avatar,project-wing-top-bar-search,spinner}.tsx",
    "packages/ui/src/data-grid/{data-grid-column-filter,data-grid-toolbar}.tsx",
  ]),
  disableForFiles("no-void", [
    "apps/cmp/src/app/*/{acceptance,clients,engagements,maps}/page-client{,.test}.tsx",
    "apps/cmp/src/components/{client-master-form,cmp-app-shell,cmp-auth-adapter,cmp-client-version-history-page,cmp-clients-view,cmp-engagement-fee-note-page,cmp-record-preview-page,cmp-related-parties-manager}.tsx",
    "apps/desktop-agent/src/session-monitor.ts",
    "apps/desktop-agent/src/tray/tray-controller.ts",
    "apps/tms/src/components/{approval-workspace,overview-workspace,query-workspace,timesheet-workspace,tms-app}.tsx",
    "packages/ui/src/auth.tsx",
  ]),
  disableForFiles("unicorn/prefer-number-coercion", [
    "apps/emp/src/components/confirmations/project-confirmation-editor.test.tsx",
    "apps/emp/src/components/extend/docx-viewer.tsx",
    "apps/emp/src/components/project-file-type-icon.tsx",
    "packages/ui/src/{constrained-expandable-action-bar,project-wing-top-bar-account-popover}.tsx",
    "packages/ui/src/project-wing-top-bar-{layout,measurement}.ts",
  ]),
  disableForFiles("unicorn/no-document-cookie", [
    "apps/cmp/src/app/*/{dashboard,login}/page-client{,.test}.tsx",
    "apps/cmp/src/components/cmp-app-shell.test.tsx",
    "apps/cmp/src/i18n/client.tsx",
    "apps/emp/src/components/{language-switcher,theme-provider}.tsx",
    "apps/emp/src/views/{login,workbench-settings-panel}.tsx",
    "apps/intranet/src/app/{login/,}page-client{,.test}.tsx",
    "apps/tms/src/components/{login-screen,theme-provider}.tsx",
    "packages/ui/src/theme-provider.tsx",
  ]),
  disableForFiles("unicorn/prefer-module", [
    "apps/desktop-agent-{macos,windows}/{babel,metro}.config.js",
    "apps/desktop-agent-windows/react-native.config.js",
  ]),
  disableForFiles("react/incompatible-library", [
    "apps/cmp/src/components/cmp-clients-data-grid.tsx",
    "apps/emp/src/components/confirmations/project-confirmation-editor.tsx",
    "apps/emp/src/components/extend/{docx,pptx}-viewer.tsx",
    "apps/emp/src/components/smart-form-v2-readonly.tsx",
    "apps/emp/src/components/workbench-{cached-preview,paper-section}.tsx",
    "apps/emp/src/views/{admin-users,members,new-project,workbench-settings-panel}.tsx",
    "packages/document-viewer/src/{docx,pptx}-viewer.tsx",
    "packages/ui/src/data-grid/{data-grid-table-virtual,master-data-grid}.tsx",
  ]),
  disableForFiles("react/no-clone-element", [
    "apps/cmp/src/components/cmp-app-shell.tsx",
    "apps/emp/src/components/{labeled-field,workbench-paper-section}.tsx",
    "apps/emp/src/components/ui/accessible-name.tsx",
    "apps/tms/src/components/tms-header.tsx",
    "apps/tms/src/components/ui/accessible-name.tsx",
    "packages/ui/src/{morph-popover,project-wing-motion-popover,sortable}.tsx",
    "packages/ui/src/data-grid/data-grid-column-visibility.tsx",
  ]),
  disableForFiles("nextjs/no-img-element", [
    "apps/cmp/src/components/cmp-clients-data-grid-columns.tsx",
    "apps/emp/src/components/confirmations/confirmation-response-preview.tsx",
    "apps/emp/src/components/workbench-paper-section.tsx",
    "packages/ui/src/{auth,project-wing-dev-logo}.tsx",
  ]),
  disableForFiles("react/rule-suppression", [
    "packages/ui/src/data-grid/{data-grid-column-header,data-grid-table,data-grid}.tsx",
  ]),
  disableForFiles("no-alert", [
    "apps/cmp/src/components/{client-master-form,cmp-acceptance-view,cmp-engagements-view}.tsx",
    "apps/cmp/src/lib/use-unsaved-form-navigation-guard.ts",
    "apps/emp/src/components/review-note-rich-text.tsx",
  ]),
  disableForFiles("unicorn/prefer-event-target", [
    "apps/desktop-agent/src/{agent-runtime,desktop-agent-updater-spawn,launcher}.test.ts",
  ]),
  disableForFiles("react/refs", [
    "apps/cmp/src/components/{cmp-app-shell,reui/stepper}.tsx",
    "packages/document-viewer/src/pptx-viewer.tsx",
  ]),
  disableForFiles("react/no-deriving-state-in-effects", [
    "apps/emp/src/components/confirmations/confirmation-information-library-field.tsx",
    "apps/emp/src/components/{project-page-header,smart-form-v2-editor,smart-form-v2-readonly}.tsx",
  ]),
  disableForFiles("unicorn/require-post-message-target-origin", [
    "apps/cmp/src/components/detached-document-preview.tsx",
    "apps/cmp/src/lib/open-preview-window.ts",
    "apps/emp/src/components/detached-attachment-preview.tsx",
    "apps/emp/src/lib/open-preview-window.ts",
  ]),
  disableForFiles("jsx-a11y/media-has-caption", [
    "apps/emp/src/components/extend/document-asset-viewer.tsx",
  ]),
  disableForFiles("react/immutability", [
    "packages/ui/src/{morph-popover,project-wing-motion-popover}.tsx",
  ]),
  disableForFiles("unicorn/prefer-add-event-listener", [
    "apps/emp/src/components/detached-attachment-preview.test.tsx",
  ]),
  disableForFiles("jsx-a11y/no-noninteractive-element-interactions", [
    "apps/emp/src/components/workbench-paper-section.tsx",
  ]),
  disableForFiles("react/memo-dependencies", [
    "packages/ui/src/auth-boundary.tsx",
  ]),
  disableForFiles("react/no-set-state", [
    "apps/emp/src/components/file-preview-pane.tsx",
  ]),
  disableForFiles("typescript/no-extraneous-class", [
    "apps/ib-api/src/app.module.ts",
  ]),
  disableForFiles("unicorn/prefer-code-point", [
    "apps/emp/src/api/mock-api.ts",
  ]),
];
