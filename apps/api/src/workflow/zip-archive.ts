import JSZip from "jszip";

export type ZipEntryNode = {
  path: string;
  name: string;
  type: "file" | "folder";
  modifiedAt?: string;
  size?: number;
  children?: ZipEntryNode[];
};

export type ZipEntryFile = {
  path: string;
  name: string;
  modifiedAt?: string;
  size: number;
  content: Buffer;
};

export type ZipOperation =
  | { type: "DELETE_ENTRY"; entryPath: string }
  | {
      type: "RENAME_ENTRY" | "MOVE_ENTRY" | "COPY_ENTRY";
      entryPath: string;
      targetPath: string;
    }
  | { type: "CREATE_FOLDER"; entryPath: string }
  | {
      type: "ADD_FILE" | "REPLACE_FILE";
      entryPath: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      content: Buffer;
    };

export type ZipEntryTreeOperation =
  | { type: "DELETE_ENTRY"; entryPath: string }
  | {
      type: "RENAME_ENTRY" | "MOVE_ENTRY" | "COPY_ENTRY";
      entryPath: string;
      targetPath: string;
    }
  | { type: "CREATE_FOLDER"; entryPath: string }
  | {
      type: "ADD_FILE" | "REPLACE_FILE";
      entryPath: string;
      fileSize?: number;
    };

const UNSAFE_ZIP_PATH_MESSAGE = "Unsafe zip path";
const ZIP_ENTRY_EXISTS_MESSAGE = "Zip entry already exists";
const ZIP_ENTRY_MISSING_MESSAGE = "Zip entry does not exist";
const STABLE_ZIP_ENTRY_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

type TreeEntry =
  | {
      path: string;
      modifiedAt?: string;
      type: "folder";
    }
  | {
      path: string;
      modifiedAt?: string;
      size: number;
      type: "file";
    };

type VirtualZipFile = {
  path: string;
  modifiedAt?: string;
  size: number;
  content?: Buffer;
  baseEntry?: JSZip.JSZipObject;
};

type VirtualZipState = {
  files: Map<string, VirtualZipFile>;
  folders: Set<string>;
};

export function validateZipEntryPath(path: string): string {
  const trimmed = path.trim();

  if (
    !trimmed ||
    trimmed.includes("\0") ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new Error(UNSAFE_ZIP_PATH_MESSAGE);
  }

  const normalized = trimmed.replaceAll(/\/+/g, "/");
  const segments = normalized.endsWith("/")
    ? normalized.slice(0, -1).split("/")
    : normalized.split("/");

  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(UNSAFE_ZIP_PATH_MESSAGE);
  }

  return normalized;
}

export async function buildZipEntryTree(
  buffer: Buffer
): Promise<ZipEntryNode[]> {
  const zip = await JSZip.loadAsync(buffer);
  validateLoadedZipEntries(zip);
  const entries = Object.values(zip.files).map((entry): TreeEntry => {
    const path = validateZipEntryPath(entry.name);

    if (entry.dir) {
      return {
        path: ensureFolderPath(path),
        modifiedAt: entry.date?.toISOString(),
        type: "folder",
      };
    }

    return {
      path,
      modifiedAt: entry.date?.toISOString(),
      size: getEntrySize(entry),
      type: "file",
    };
  });

  return entriesToTree(entries);
}

export async function readZipEntryFile(
  buffer: Buffer,
  entryPath: string
): Promise<ZipEntryFile> {
  const zip = await JSZip.loadAsync(buffer);
  validateLoadedZipEntries(zip);
  const filePath = validateZipEntryPath(entryPath);
  const entry = zip.files[filePath];

  if (isFolderPath(filePath) || !entry || entry.dir) {
    throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
  }

  return {
    path: filePath,
    name: getEntryName(filePath),
    modifiedAt: entry.date?.toISOString(),
    size: getEntrySize(entry),
    content: await entry.async("nodebuffer"),
  };
}

export async function readZipEntryFileWithOperations(
  baseBuffer: Buffer,
  operations: ZipOperation[],
  entryPath: string
): Promise<ZipEntryFile> {
  const zip = await JSZip.loadAsync(baseBuffer);
  validateLoadedZipEntries(zip);
  const state = buildVirtualZipState(zip);

  for (const operation of operations) {
    applyVirtualOperation(state, operation);
  }

  const filePath = validateFilePath(entryPath);
  const file = state.files.get(filePath);
  if (!file) {
    throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
  }

  const content =
    file.content ?? (await file.baseEntry?.async("nodebuffer")) ?? null;
  if (!content) {
    throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
  }

  return {
    path: file.path,
    name: getEntryName(file.path),
    modifiedAt: file.modifiedAt,
    size: file.size,
    content,
  };
}

export async function rebuildZipWithOperations(
  baseBuffer: Buffer,
  operations: ZipOperation[]
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(baseBuffer);
  validateLoadedZipEntries(zip);

  for (const operation of operations) {
    await applyOperation(zip, operation);
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function applyZipOperationsToEntryTree(
  baseEntries: ZipEntryNode[],
  operations: ZipEntryTreeOperation[]
): ZipEntryNode[] {
  const entries = flattenEntryTree(baseEntries);

  for (const operation of operations) {
    applyTreeOperation(entries, operation);
  }

  return entriesToTree(entries);
}

function entriesToTree(entries: TreeEntry[]): ZipEntryNode[] {
  const root: ZipEntryNode[] = [];
  const folders = new Map<string, ZipEntryNode>();
  const files = new Set<string>();

  for (const entry of entries) {
    if (entry.type === "folder") {
      ensureFolder(entry.path, root, folders, entry.modifiedAt);
      continue;
    }

    const parentPath = getParentFolderPath(entry.path);
    const siblings =
      parentPath === null
        ? root
        : (ensureFolder(parentPath, root, folders).children ?? []);

    if (files.has(entry.path)) {
      continue;
    }

    siblings.push({
      name: getEntryName(entry.path),
      path: entry.path,
      modifiedAt: entry.modifiedAt,
      size: entry.size,
      type: "file",
    });
    files.add(entry.path);
  }

  sortTree(root);
  return root;
}

function flattenEntryTree(entries: ZipEntryNode[]): TreeEntry[] {
  return entries.flatMap((entry): TreeEntry[] => {
    const current =
      entry.type === "folder"
        ? ({
            path: ensureFolderPath(validateZipEntryPath(entry.path)),
            modifiedAt: entry.modifiedAt,
            type: "folder" as const,
          } satisfies TreeEntry)
        : ({
            path: validateFilePath(entry.path),
            modifiedAt: entry.modifiedAt,
            size: entry.size ?? 0,
            type: "file" as const,
          } satisfies TreeEntry);
    return entry.type === "folder"
      ? [current, ...flattenEntryTree(entry.children ?? [])]
      : [current];
  });
}

function applyTreeOperation(
  entries: TreeEntry[],
  operation: ZipEntryTreeOperation
): void {
  switch (operation.type) {
    case "DELETE_ENTRY": {
      deleteTreeEntry(
        entries,
        resolveExistingTreePath(entries, operation.entryPath)
      );
      return;
    }
    case "RENAME_ENTRY":
    case "MOVE_ENTRY": {
      moveTreeEntry(
        entries,
        resolveExistingTreePath(entries, operation.entryPath),
        operation.targetPath
      );
      return;
    }
    case "COPY_ENTRY": {
      copyTreeEntry(
        entries,
        resolveExistingTreePath(entries, operation.entryPath),
        operation.targetPath
      );
      return;
    }
    case "CREATE_FOLDER": {
      createTreeFolder(entries, operation.entryPath);
      return;
    }
    case "ADD_FILE": {
      addTreeFile(entries, operation.entryPath, operation.fileSize ?? 0);
      return;
    }
    case "REPLACE_FILE": {
      replaceTreeFile(entries, operation.entryPath, operation.fileSize ?? 0);
      break;
    }

    default: {
      break;
    }
  }
}

function deleteTreeEntry(entries: TreeEntry[], entryPath: string): void {
  const shouldDelete = isFolderPath(entryPath)
    ? (entry: TreeEntry) =>
        entry.path === entryPath || entry.path.startsWith(entryPath)
    : (entry: TreeEntry) => entry.path === entryPath;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (shouldDelete(entries[index])) {
      entries.splice(index, 1);
    }
  }
}

function copyTreeEntry(
  entries: TreeEntry[],
  entryPath: string,
  targetPath: string
): void {
  const isFolder = isFolderPath(entryPath);
  const normalizedTarget = isFolder
    ? ensureFolderPath(validateZipEntryPath(targetPath))
    : validateFilePath(targetPath);

  if (isFolder && normalizedTarget.startsWith(entryPath)) {
    throw new Error("Cannot copy a folder into itself");
  }

  assertNoTreeEntryCollision(entries, normalizedTarget);
  const copied = cloneTreeEntriesForTarget(
    entries,
    entryPath,
    normalizedTarget
  );
  ensureTreeParentFolders(entries, normalizedTarget);
  entries.push(...copied);
}

function moveTreeEntry(
  entries: TreeEntry[],
  entryPath: string,
  targetPath: string
): void {
  const isFolder = isFolderPath(entryPath);
  const normalizedTarget = isFolder
    ? ensureFolderPath(validateZipEntryPath(targetPath))
    : validateFilePath(targetPath);

  if (entryPath === normalizedTarget) {
    return;
  }

  if (isFolder && normalizedTarget.startsWith(entryPath)) {
    throw new Error("Cannot move a folder into itself");
  }

  assertNoTreeEntryCollision(entries, normalizedTarget);
  const moved = cloneTreeEntriesForTarget(entries, entryPath, normalizedTarget);
  deleteTreeEntry(entries, entryPath);
  ensureTreeParentFolders(entries, normalizedTarget);
  entries.push(...moved);
}

function cloneTreeEntriesForTarget(
  entries: TreeEntry[],
  entryPath: string,
  normalizedTarget: string
): TreeEntry[] {
  const isFolder = isFolderPath(entryPath);
  return entries
    .filter((entry) =>
      isFolder
        ? entry.path === entryPath || entry.path.startsWith(entryPath)
        : entry.path === entryPath
    )
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry): TreeEntry => {
      const nextPath = isFolder
        ? `${normalizedTarget}${entry.path.slice(entryPath.length)}`
        : normalizedTarget;
      return entry.type === "folder"
        ? {
            path: ensureFolderPath(nextPath),
            modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
            type: "folder",
          }
        : {
            path: validateFilePath(nextPath),
            modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
            size: entry.size,
            type: "file",
          };
    });
}

function createTreeFolder(entries: TreeEntry[], entryPath: string): void {
  const folderPath = ensureFolderPath(validateZipEntryPath(entryPath));
  assertNoTreeEntryCollision(entries, folderPath);
  ensureTreeParentFolders(entries, folderPath);
  entries.push({
    path: folderPath,
    modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
    type: "folder",
  });
}

function addTreeFile(
  entries: TreeEntry[],
  entryPath: string,
  fileSize: number
): void {
  const filePath = validateFilePath(entryPath);
  assertNoTreeEntryCollision(entries, filePath);
  ensureTreeParentFolders(entries, filePath);
  entries.push({
    path: filePath,
    modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
    size: fileSize,
    type: "file",
  });
}

function replaceTreeFile(
  entries: TreeEntry[],
  entryPath: string,
  fileSize: number
): void {
  const filePath = validateFilePath(entryPath);
  const existing = entries.find(
    (entry): entry is Extract<TreeEntry, { type: "file" }> =>
      entry.type === "file" && entry.path === filePath
  );
  if (!existing) {
    throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
  }
  existing.modifiedAt = STABLE_ZIP_ENTRY_DATE.toISOString();
  existing.size = fileSize;
}

function resolveExistingTreePath(
  entries: TreeEntry[],
  entryPath: string
): string {
  const normalized = validateZipEntryPath(entryPath);

  if (!isFolderPath(normalized) && hasTreeFileEntry(entries, normalized)) {
    return normalized;
  }

  const folderPath = ensureFolderPath(normalized);
  if (hasTreeFolderEntry(entries, folderPath)) {
    return folderPath;
  }

  throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
}

function assertNoTreeEntryCollision(
  entries: TreeEntry[],
  entryPath: string
): void {
  if (isFolderPath(entryPath)) {
    assertNoTreeFileAtFolderPath(entries, entryPath);
  }

  if (
    hasTreeFileEntry(entries, entryPath) ||
    hasTreeFolderEntry(entries, ensureFolderPath(entryPath))
  ) {
    throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
  }
}

function assertNoTreeFileAtFolderPath(
  entries: TreeEntry[],
  folderPath: string
): void {
  const filePath = folderPath.slice(0, -1);
  if (hasTreeFileEntry(entries, filePath)) {
    throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
  }
}

function ensureTreeParentFolders(
  entries: TreeEntry[],
  entryPath: string
): void {
  let parentPath = getParentFolderPath(entryPath);

  while (parentPath) {
    if (!hasExactTreeFolderEntry(entries, parentPath)) {
      entries.push({
        path: parentPath,
        modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
        type: "folder",
      });
    }
    parentPath = getParentFolderPath(parentPath);
  }
}

function hasTreeFileEntry(entries: TreeEntry[], filePath: string): boolean {
  return entries.some(
    (entry) => entry.type === "file" && entry.path === filePath
  );
}

function hasTreeFolderEntry(entries: TreeEntry[], folderPath: string): boolean {
  const normalized = ensureFolderPath(folderPath);
  return entries.some(
    (entry) =>
      (entry.type === "folder" && entry.path === normalized) ||
      entry.path.startsWith(normalized)
  );
}

function hasExactTreeFolderEntry(
  entries: TreeEntry[],
  folderPath: string
): boolean {
  const normalized = ensureFolderPath(folderPath);
  return entries.some(
    (entry) => entry.type === "folder" && entry.path === normalized
  );
}

function buildVirtualZipState(zip: JSZip): VirtualZipState {
  const files = new Map<string, VirtualZipFile>();
  const folders = new Set<string>();

  for (const entry of Object.values(zip.files)) {
    const path = validateZipEntryPath(entry.name);
    if (entry.dir) {
      addVirtualFolderPaths(folders, ensureFolderPath(path));
      continue;
    }

    files.set(path, {
      path,
      modifiedAt: entry.date?.toISOString(),
      size: getEntrySize(entry),
      baseEntry: entry,
    });
    addVirtualParentFolderPaths(folders, path);
  }

  return { files, folders };
}

function applyVirtualOperation(
  state: VirtualZipState,
  operation: ZipOperation
): void {
  switch (operation.type) {
    case "DELETE_ENTRY": {
      deleteVirtualEntry(
        state,
        resolveExistingVirtualPath(state, operation.entryPath)
      );
      return;
    }
    case "RENAME_ENTRY":
    case "MOVE_ENTRY": {
      moveVirtualEntry(
        state,
        resolveExistingVirtualPath(state, operation.entryPath),
        operation.targetPath
      );
      return;
    }
    case "COPY_ENTRY": {
      copyVirtualEntry(
        state,
        resolveExistingVirtualPath(state, operation.entryPath),
        operation.targetPath
      );
      return;
    }
    case "CREATE_FOLDER": {
      createVirtualFolder(state, operation.entryPath);
      return;
    }
    case "ADD_FILE": {
      addVirtualFile(state, operation.entryPath, operation.content);
      return;
    }
    case "REPLACE_FILE": {
      replaceVirtualFile(state, operation.entryPath, operation.content);
      break;
    }

    default: {
      break;
    }
  }
}

function deleteVirtualEntry(state: VirtualZipState, entryPath: string): void {
  if (isFolderPath(entryPath)) {
    for (const filePath of state.files.keys()) {
      if (filePath.startsWith(entryPath)) {
        state.files.delete(filePath);
      }
    }
    for (const folderPath of state.folders) {
      if (folderPath === entryPath || folderPath.startsWith(entryPath)) {
        state.folders.delete(folderPath);
      }
    }
    return;
  }

  state.files.delete(entryPath);
}

function copyVirtualEntry(
  state: VirtualZipState,
  entryPath: string,
  targetPath: string
): void {
  const copied = cloneVirtualEntriesForTarget(state, entryPath, targetPath);
  for (const folderPath of copied.folders) {
    state.folders.add(folderPath);
  }
  for (const file of copied.files) {
    state.files.set(file.path, file);
  }
}

function moveVirtualEntry(
  state: VirtualZipState,
  entryPath: string,
  targetPath: string
): void {
  const normalizedTarget = isFolderPath(entryPath)
    ? ensureFolderPath(validateZipEntryPath(targetPath))
    : validateFilePath(targetPath);
  if (entryPath === normalizedTarget) {
    return;
  }
  const copied = cloneVirtualEntriesForTarget(state, entryPath, targetPath);
  deleteVirtualEntry(state, entryPath);
  for (const folderPath of copied.folders) {
    state.folders.add(folderPath);
  }
  for (const file of copied.files) {
    state.files.set(file.path, file);
  }
}

function cloneVirtualEntriesForTarget(
  state: VirtualZipState,
  entryPath: string,
  targetPath: string
): {
  normalizedTarget: string;
  folders: string[];
  files: VirtualZipFile[];
} {
  const isFolder = isFolderPath(entryPath);
  const normalizedTarget = isFolder
    ? ensureFolderPath(validateZipEntryPath(targetPath))
    : validateFilePath(targetPath);

  if (isFolder && normalizedTarget.startsWith(entryPath)) {
    throw new Error("Cannot move a folder into itself");
  }

  assertNoVirtualEntryCollision(state, normalizedTarget);
  const folders = isFolder ? [normalizedTarget] : [];
  const files = [...state.files.values()]
    .filter((file) =>
      isFolder ? file.path.startsWith(entryPath) : file.path === entryPath
    )
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file): VirtualZipFile => {
      const nextPath = isFolder
        ? validateFilePath(
            `${normalizedTarget}${file.path.slice(entryPath.length)}`
          )
        : normalizedTarget;
      return {
        ...file,
        path: nextPath,
        modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
      };
    });

  for (const file of files) {
    addVirtualParentFolderPathsToList(folders, file.path);
  }

  return { normalizedTarget, folders, files };
}

function createVirtualFolder(state: VirtualZipState, entryPath: string): void {
  const folderPath = ensureFolderPath(validateZipEntryPath(entryPath));
  assertNoVirtualEntryCollision(state, folderPath);
  addVirtualParentFolderPaths(state.folders, folderPath);
  state.folders.add(folderPath);
}

function addVirtualFile(
  state: VirtualZipState,
  entryPath: string,
  content: Buffer
): void {
  const filePath = validateFilePath(entryPath);
  assertNoVirtualEntryCollision(state, filePath);
  addVirtualParentFolderPaths(state.folders, filePath);
  state.files.set(filePath, {
    path: filePath,
    modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
    size: content.length,
    content,
  });
}

function replaceVirtualFile(
  state: VirtualZipState,
  entryPath: string,
  content: Buffer
): void {
  const filePath = validateFilePath(entryPath);
  if (!state.files.has(filePath)) {
    throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
  }
  state.files.set(filePath, {
    path: filePath,
    modifiedAt: STABLE_ZIP_ENTRY_DATE.toISOString(),
    size: content.length,
    content,
  });
}

function resolveExistingVirtualPath(
  state: VirtualZipState,
  entryPath: string
): string {
  const normalized = validateZipEntryPath(entryPath);

  if (!isFolderPath(normalized) && state.files.has(normalized)) {
    return normalized;
  }

  const folderPath = ensureFolderPath(normalized);
  if (
    state.folders.has(folderPath) ||
    [...state.files.keys()].some((filePath) => filePath.startsWith(folderPath))
  ) {
    return folderPath;
  }

  throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
}

function assertNoVirtualEntryCollision(
  state: VirtualZipState,
  entryPath: string
): void {
  if (isFolderPath(entryPath) && state.files.has(entryPath.slice(0, -1))) {
    throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
  }

  if (
    state.files.has(entryPath) ||
    state.folders.has(ensureFolderPath(entryPath)) ||
    [...state.files.keys()].some((filePath) =>
      filePath.startsWith(ensureFolderPath(entryPath))
    )
  ) {
    throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
  }
}

function addVirtualFolderPaths(folders: Set<string>, folderPath: string): void {
  let current: string | null = folderPath;

  while (current) {
    folders.add(current);
    current = getParentFolderPath(current);
  }
}

function addVirtualParentFolderPaths(
  folders: Set<string>,
  filePath: string
): void {
  const parentPath = getParentFolderPath(filePath);
  if (parentPath) {
    addVirtualFolderPaths(folders, parentPath);
  }
}

function addVirtualParentFolderPathsToList(
  folders: string[],
  filePath: string
): void {
  const nextFolders = new Set(folders);
  addVirtualParentFolderPaths(nextFolders, filePath);
  folders.splice(0, folders.length, ...nextFolders);
}

function ensureFolder(
  folderPath: string,
  root: ZipEntryNode[],
  folders: Map<string, ZipEntryNode>,
  modifiedAt?: string
): ZipEntryNode {
  const normalized = ensureFolderPath(folderPath);
  const existing = folders.get(normalized);

  if (existing) {
    if (modifiedAt) {
      existing.modifiedAt = modifiedAt;
    }
    return existing;
  }

  const parentPath = getParentFolderPath(normalized);
  const node: ZipEntryNode = {
    name: getEntryName(normalized),
    path: normalized,
    modifiedAt,
    type: "folder",
    children: [],
  };
  folders.set(normalized, node);

  if (parentPath === null) {
    root.push(node);
    return node;
  }

  const parent = ensureFolder(parentPath, root, folders);
  parent.children?.push(node);
  return node;
}

async function applyOperation(
  zip: JSZip,
  operation: ZipOperation
): Promise<void> {
  switch (operation.type) {
    case "DELETE_ENTRY": {
      deleteEntry(zip, resolveExistingPath(zip, operation.entryPath));
      return;
    }
    case "RENAME_ENTRY":
    case "MOVE_ENTRY": {
      await moveEntry(
        zip,
        resolveExistingPath(zip, operation.entryPath),
        operation.targetPath
      );
      return;
    }
    case "COPY_ENTRY": {
      await copyEntry(
        zip,
        resolveExistingPath(zip, operation.entryPath),
        operation.targetPath
      );
      return;
    }
    case "CREATE_FOLDER": {
      createFolder(zip, operation.entryPath);
      return;
    }
    case "ADD_FILE": {
      addFile(zip, operation.entryPath, operation.content);
      return;
    }
    case "REPLACE_FILE": {
      replaceFile(zip, operation.entryPath, operation.content);
      break;
    }

    default: {
      break;
    }
  }
}

function deleteEntry(zip: JSZip, entryPath: string): void {
  if (isFolderPath(entryPath)) {
    for (const name of getEntryNames(zip)) {
      if (name === entryPath || name.startsWith(entryPath)) {
        zip.remove(name);
      }
    }
    return;
  }

  zip.remove(entryPath);
}

async function copyEntry(
  zip: JSZip,
  entryPath: string,
  targetPath: string
): Promise<void> {
  const isFolder = isFolderPath(entryPath);
  const normalizedTarget = isFolder
    ? ensureFolderPath(validateZipEntryPath(targetPath))
    : validateFilePath(targetPath);

  if (isFolder && normalizedTarget.startsWith(entryPath)) {
    throw new Error("Cannot copy a folder into itself");
  }

  assertNoEntryCollision(zip, normalizedTarget);

  const entries = Object.values(zip.files)
    .filter((entry) =>
      isFolder
        ? entry.name === entryPath || entry.name.startsWith(entryPath)
        : entry.name === entryPath
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  if (isFolder) {
    putFolder(zip, normalizedTarget);
  }

  for (const entry of entries) {
    const newPath = isFolder
      ? `${normalizedTarget}${entry.name.slice(entryPath.length)}`
      : normalizedTarget;

    if (entry.dir) {
      putFolder(zip, newPath);
      continue;
    }

    putFile(zip, newPath, await entry.async("nodebuffer"));
  }
}

async function moveEntry(
  zip: JSZip,
  entryPath: string,
  targetPath: string
): Promise<void> {
  const isFolder = isFolderPath(entryPath);
  const normalizedTarget = isFolder
    ? ensureFolderPath(validateZipEntryPath(targetPath))
    : validateFilePath(targetPath);

  if (entryPath === normalizedTarget) {
    return;
  }

  if (isFolder && normalizedTarget.startsWith(entryPath)) {
    throw new Error("Cannot move a folder into itself");
  }

  assertNoEntryCollision(zip, normalizedTarget);

  const entries = Object.values(zip.files)
    .filter((entry) =>
      isFolder
        ? entry.name === entryPath || entry.name.startsWith(entryPath)
        : entry.name === entryPath
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const newPath = isFolder
      ? `${normalizedTarget}${entry.name.slice(entryPath.length)}`
      : normalizedTarget;

    if (entry.dir) {
      putFolder(zip, newPath);
      continue;
    }

    putFile(zip, newPath, await entry.async("nodebuffer"));
  }

  deleteEntry(zip, entryPath);
}

function resolveExistingPath(zip: JSZip, entryPath: string): string {
  const normalized = validateZipEntryPath(entryPath);

  if (!isFolderPath(normalized) && hasFileEntry(zip, normalized)) {
    return normalized;
  }

  const folderPath = ensureFolderPath(normalized);
  const hasFolder = Boolean(zip.files[folderPath]?.dir);
  const hasChildren = getEntryNames(zip).some((name) =>
    name.startsWith(folderPath)
  );

  if (hasFolder || hasChildren) {
    return folderPath;
  }

  throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
}

function createFolder(zip: JSZip, entryPath: string): void {
  const folderPath = ensureFolderPath(validateZipEntryPath(entryPath));
  assertNoEntryCollision(zip, folderPath);
  assertNoFileAtFolderPath(zip, folderPath);
  putFolder(zip, folderPath);
}

function addFile(zip: JSZip, entryPath: string, content: Buffer): void {
  const filePath = validateFilePath(entryPath);
  assertNoEntryCollision(zip, filePath);
  putFile(zip, filePath, content);
}

function replaceFile(zip: JSZip, entryPath: string, content: Buffer): void {
  const filePath = validateFilePath(entryPath);
  if (!hasFileEntry(zip, filePath)) {
    throw new Error(ZIP_ENTRY_MISSING_MESSAGE);
  }
  putFile(zip, filePath, content);
}

function validateFilePath(entryPath: string): string {
  const normalized = validateZipEntryPath(entryPath);

  if (isFolderPath(normalized)) {
    throw new Error(UNSAFE_ZIP_PATH_MESSAGE);
  }

  return normalized;
}

function getEntryNames(zip: JSZip): string[] {
  return Object.keys(zip.files);
}

function validateLoadedZipEntries(zip: JSZip): void {
  const filePaths = new Set<string>();
  const folderPaths = new Set<string>();

  for (const entry of Object.values(zip.files)) {
    const { unsafeOriginalName } = entry as JSZip.JSZipObject & {
      unsafeOriginalName?: string;
    };

    if (unsafeOriginalName) {
      validateZipEntryPath(unsafeOriginalName);
    }
    const path = validateZipEntryPath(entry.name);

    if (entry.dir) {
      addFolderPaths(folderPaths, ensureFolderPath(path));
    } else {
      filePaths.add(path);
      addParentFolderPaths(folderPaths, path);
    }
  }

  for (const filePath of filePaths) {
    if (folderPaths.has(ensureFolderPath(filePath))) {
      throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
    }
  }
}

function assertNoEntryCollision(zip: JSZip, entryPath: string): void {
  if (isFolderPath(entryPath)) {
    assertNoFileAtFolderPath(zip, entryPath);
  }

  if (
    zip.files[entryPath] ||
    hasFolderEntry(zip, ensureFolderPath(entryPath))
  ) {
    throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
  }
}

function assertNoFileAtFolderPath(zip: JSZip, folderPath: string): void {
  const filePath = folderPath.slice(0, -1);
  if (hasFileEntry(zip, filePath)) {
    throw new Error(ZIP_ENTRY_EXISTS_MESSAGE);
  }
}

function hasFileEntry(zip: JSZip, filePath: string): boolean {
  const entry = zip.files[filePath];
  return Boolean(entry && !entry.dir);
}

function hasFolderEntry(zip: JSZip, folderPath: string): boolean {
  const normalized = ensureFolderPath(folderPath);
  return Boolean(
    zip.files[normalized]?.dir ||
    getEntryNames(zip).some((name) => name.startsWith(normalized))
  );
}

function addFolderPaths(folderPaths: Set<string>, folderPath: string): void {
  let current: string | null = folderPath;

  while (current) {
    folderPaths.add(current);
    current = getParentFolderPath(current);
  }
}

function addParentFolderPaths(
  folderPaths: Set<string>,
  filePath: string
): void {
  const parentPath = getParentFolderPath(filePath);
  if (parentPath) {
    addFolderPaths(folderPaths, parentPath);
  }
}

function putFolder(zip: JSZip, folderPath: string): void {
  const normalized = ensureFolderPath(folderPath);
  const parentPath = getParentFolderPath(normalized);
  if (parentPath) {
    ensureZipFolder(zip, parentPath);
  }
  zip.file(normalized, null, {
    date: STABLE_ZIP_ENTRY_DATE,
    dir: true,
  });
}

function putFile(zip: JSZip, filePath: string, content: Buffer): void {
  const parentPath = getParentFolderPath(filePath);
  if (parentPath) {
    ensureZipFolder(zip, parentPath);
  }
  zip.file(filePath, content, { date: STABLE_ZIP_ENTRY_DATE });
}

function ensureZipFolder(zip: JSZip, folderPath: string): void {
  const normalized = ensureFolderPath(folderPath);
  if (zip.files[normalized]?.dir) {
    return;
  }
  putFolder(zip, normalized);
}

function ensureFolderPath(entryPath: string): string {
  return isFolderPath(entryPath) ? entryPath : `${entryPath}/`;
}

function isFolderPath(entryPath: string): boolean {
  return entryPath.endsWith("/");
}

function getParentFolderPath(entryPath: string): string | null {
  const withoutTrailingSlash = isFolderPath(entryPath)
    ? entryPath.slice(0, -1)
    : entryPath;
  const lastSlash = withoutTrailingSlash.lastIndexOf("/");

  if (lastSlash === -1) {
    return null;
  }

  return `${withoutTrailingSlash.slice(0, lastSlash)}/`;
}

function getEntryName(entryPath: string): string {
  const withoutTrailingSlash = isFolderPath(entryPath)
    ? entryPath.slice(0, -1)
    : entryPath;
  const lastSlash = withoutTrailingSlash.lastIndexOf("/");
  return withoutTrailingSlash.slice(lastSlash + 1);
}

function getEntrySize(entry: JSZip.JSZipObject): number {
  return (
    (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })
      ._data?.uncompressedSize ?? 0
  );
}

function sortTree(nodes: ZipEntryNode[]): void {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "folder" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}
