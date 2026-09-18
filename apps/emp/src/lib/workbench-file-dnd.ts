export const WORKBENCH_FILE_DRAG_TYPE = "workbench-file";
export const WORKBENCH_FILE_PREVIEW_DROPPABLE_ID =
  "workbench-file-preview-dropzone";
export const WORKBENCH_FILE_DIRECTORY_DROP_TYPE =
  "workbench-file-directory-drop";

export function getWorkbenchDirectoryDropId(workflowNodeId: string) {
  return `workbench-file-directory:${workflowNodeId}`;
}

export function getWorkbenchFileSortableId(attachmentId: string) {
  return `workbench-file:${attachmentId}`;
}
