/** Opens a record document without giving the new tab access to this window. */
export function openCmpRecordPreviewWindow(path: string) {
  if (window.matchMedia?.("(max-width: 767.98px)").matches) {
    window.location.assign(path);
    return null;
  }
  const previewWindow = window.open(path, "_blank", "noopener,noreferrer");
  if (previewWindow) {
    previewWindow.opener = null;
  }
  return previewWindow;
}
