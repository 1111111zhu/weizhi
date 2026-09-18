import { inspect } from "node:util";

import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";

export type ArchiveFileIndexSignoff = {
  email: string;
  name: string;
  signedAt: string;
};

export type ArchiveFileIndexFile = {
  archivePath: string;
  attachmentId: string;
  fileKind: string;
  fileName: string;
  fileReference: string;
  fileSize: number;
  mimeType: string;
  preparerSignoff?: ArchiveFileIndexSignoff;
  reviewerSignoff?: ArchiveFileIndexSignoff;
  sha256: string;
  signoffStatus: "COMPLETE" | "MISSING_PREPARER" | "MISSING_REVIEWER";
  smartFormStatus?: string;
  sourceFileKind?: string;
  sourceFileName?: string;
  workflowNodeId: string;
  workingPaperCode: string;
  workingPaperId: string;
  workingPaperTitle: string;
};

export type ArchiveFileIndexFolder = {
  code: string;
  entryPath?: string;
  level: number;
  parentId: string | null;
  sortOrder: number;
  title: string;
  workflowNodeId: string;
};

export type ArchiveFileIndexInput = {
  fileCheckSummary: {
    blockers: number;
    warnings: number;
  };
  files: ArchiveFileIndexFile[];
  folders: ArchiveFileIndexFolder[];
  generatedAt: string;
  project: {
    clientName: string;
    engagementCode?: string;
    id: string;
    language?: string;
    name: string;
    projectCode: string;
    yearEndDate: Date | string;
  };
};

type TreeRow =
  | { depth: number; folder: ArchiveFileIndexFolder; kind: "folder" }
  | { depth: number; file: ArchiveFileIndexFile; kind: "file" };

type Copy = ReturnType<typeof archiveIndexCopy>;

export function buildArchiveFileIndexPdf(input: ArchiveFileIndexInput) {
  const compiler = NodeCompiler.create();
  const compiled = compiler.compile({
    mainFileContent: renderArchiveFileIndexTypstSource(input),
  });
  if (compiled.hasError()) {
    const compileError = compiled.takeError() ?? compiled.takeDiagnostics();
    throw new Error(formatTypstCompileError(compileError));
  }
  if (!compiled.result) {
    throw new Error("Archive file index PDF compilation returned no document");
  }
  return Buffer.from(compiler.pdf(compiled.result));
}

export function renderArchiveFileIndexTypstSource(
  input: ArchiveFileIndexInput
) {
  const zh = input.project.language?.toLowerCase().startsWith("zh") ?? true;
  const copy = archiveIndexCopy(zh);
  const treeRows = buildTreeRows(input.folders, input.files);
  const treeTableRows = treeRows
    .map((row, index) => renderTreeRow(row, index, copy))
    .join(",\n");
  const integrityRows = input.files
    .map((file, index) => renderIntegrityRow(file, index))
    .join(",\n");
  const generatedAt = formatDateTime(input.generatedAt);
  const yearEndDate = formatDate(input.project.yearEndDate);
  const fileCheckResult = input.fileCheckSummary.blockers
    ? copy.fileCheckFailed
    : copy.fileCheckPassed;

  return `
#let sans-fonts = ("Noto Sans CJK SC", "Microsoft YaHei", "Source Han Sans SC", "Inter", "Arial")
#let mono-fonts = ("Cascadia Mono", "Consolas", "DejaVu Sans Mono")
#let ink = rgb("#16231c")
#let muted = rgb("#64736b")
#let rule = rgb("#d9e3de")
#let rule-strong = rgb("#b8c9c0")
#let paper-tint = rgb("#f7faf8")
#let row-tint = rgb("#f5f8f6")
#let folder-fill = rgb("#edf7f1")
#let accent = rgb("#087a43")
#let accent-dark = rgb("#075a34")
#let accent-soft = rgb("#dcefe5")
#let pass-fill = rgb("#e5f5eb")
#set document(title: ${JSON.stringify(copy.title)}, author: "Project Wing EMP")
#let metric-card(label, value, result: false) = block(
  width: 100%,
  stroke: 0.45pt + rule,
  radius: 3pt,
  inset: (x: 9pt, y: 7pt),
  fill: if result { pass-fill } else { white },
  [#text(size: 6.5pt, fill: muted)[#label]#linebreak()#text(size: 13pt, weight: "bold", fill: if result { accent } else { ink })[#value]],
)

#set page(
  paper: "a4",
  flipped: true,
  margin: (top: 17mm, bottom: 15mm, left: 12mm, right: 12mm),
  header: context [
    #set text(font: sans-fonts, size: 7.2pt, fill: muted)
    #grid(columns: (1fr, auto),
      [#text(weight: "semibold", fill: accent)[${typstText(copy.shortTitle)}] · ${typstText(input.project.projectCode)}],
      [${typstText(input.project.name)}],
    )
    #v(1.7mm)
    #line(length: 100%, stroke: 0.45pt + rule)
  ],
  footer: context [
    #set text(font: sans-fonts, size: 6.8pt, fill: muted)
    #line(length: 100%, stroke: 0.4pt + rule)
    #v(1.2mm)
    #grid(columns: (1fr, auto),
      [${typstText(copy.footer)}],
      [${typstText(input.project.projectCode)} · #counter(page).display()],
    )
  ],
)
#set text(font: sans-fonts, size: 8pt, fill: ink)
#set par(leading: 0.58em)

#text(size: 8pt, weight: "semibold", tracking: 1.1pt, fill: accent)[${typstText(copy.eyebrow)}]
#v(2pt)
#text(size: 22pt, weight: "bold", fill: ink)[${typstText(copy.title)}]
#v(2pt)
#text(size: 9pt, fill: muted)[${typstText(copy.description)}]
#v(9pt)

#block(width: 100%, fill: paper-tint, radius: 4pt, inset: 9pt)[
  #grid(
    columns: (1.5fr, 1fr, 1fr, 1fr),
    column-gutter: 12pt,
    [#text(size: 6.5pt, fill: muted)[${typstText(copy.projectName)}]#linebreak()#text(size: 9pt, weight: "semibold")[${typstText(input.project.name)}]],
    [#text(size: 6.5pt, fill: muted)[${typstText(copy.projectCode)}]#linebreak()#text(size: 9pt, weight: "semibold")[${typstText(input.project.projectCode)}]],
    [#text(size: 6.5pt, fill: muted)[${typstText(copy.clientName)}]#linebreak()#text(size: 9pt, weight: "semibold")[${typstText(input.project.clientName)}]],
    [#text(size: 6.5pt, fill: muted)[${typstText(copy.yearEnd)}]#linebreak()#text(size: 9pt, weight: "semibold")[${typstText(yearEndDate)}]],
  )
]
#v(7pt)

#grid(columns: (1fr, 1fr, 1fr, 1.2fr), column-gutter: 7pt,
  metric-card([${typstText(copy.files)}], [${typstText(String(input.files.length))}]),
  metric-card([${typstText(copy.folders)}], [${typstText(String(input.folders.length))}]),
  metric-card([${typstText(copy.warnings)}], [${typstText(String(input.fileCheckSummary.warnings))}]),
  metric-card([${typstText(copy.fileCheck)}], [${typstText(fileCheckResult)}], result: true),
)

#v(7pt)
#block(width: 100%, stroke: (left: 2.2pt + accent), fill: folder-fill, inset: (x: 9pt, y: 6pt))[
  #text(size: 7.3pt, fill: muted)[${typstText(copy.scopeNote)}]
]

#pagebreak()
#grid(columns: (1fr, auto), align: (left, bottom),
  [#text(size: 14pt, weight: "bold")[${typstText(copy.treeTitle)}]],
  [#text(size: 7pt, fill: muted)[${typstText(copy.timezoneNote)} · ${typstText(copy.generatedAt)} ${typstText(generatedAt)}]],
)
#text(size: 7pt, fill: muted)[${typstText(copy.treeNote)}]
#v(5pt)

#table(
  columns: (12mm, 24mm, 1fr, 24mm, 17mm, 43mm, 43mm, 24mm),
  inset: (x: 3.5pt, y: 4.2pt),
  stroke: 0.35pt + rule,
  fill: (x, y) => if y == 0 { accent-dark },
  table.header(
    [#text(weight: "semibold", fill: white)[${typstText(copy.kind)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.code)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.name)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.format)}]],
    [#align(right)[#text(weight: "semibold", fill: white)[${typstText(copy.size)}]]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.preparer)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.reviewer)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.result)}]],
  ),
  ${treeTableRows || renderEmptyTreeRow(copy)}
)

#pagebreak()
#text(size: 8pt, weight: "semibold", tracking: 1.1pt, fill: accent)[${typstText(copy.appendix)}]
#v(2pt)
#text(size: 18pt, weight: "bold")[${typstText(copy.integrityTitle)}]
#v(2pt)
#text(size: 8pt, fill: muted)[${typstText(copy.integrityDescription)}]
#v(7pt)

#table(
  columns: (8mm, 24mm, 46mm, 1fr, 42mm, 18mm, 70mm),
  inset: (x: 3pt, y: 4pt),
  stroke: 0.35pt + rule,
  fill: (x, y) => if y == 0 { accent-dark },
  table.header(
    [#text(weight: "semibold", fill: white)[${typstText(copy.number)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.fileReference)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.fileName)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.archivePath)}]],
    [#text(weight: "semibold", fill: white)[${typstText(copy.sourceFile)}]],
    [#align(right)[#text(weight: "semibold", fill: white)[${typstText(copy.bytes)}]]],
    [#text(weight: "semibold", fill: white)[SHA-256]],
  ),
  ${integrityRows || renderEmptyIntegrityRow(copy)}
)
`;
}

function buildTreeRows(
  folders: ArchiveFileIndexFolder[],
  files: ArchiveFileIndexFile[]
) {
  const folderIds = new Set(folders.map((folder) => folder.workflowNodeId));
  const childrenByParent = new Map<string | null, ArchiveFileIndexFolder[]>();
  const filesByFolder = new Map<string, ArchiveFileIndexFile[]>();

  for (const folder of folders) {
    const parentId =
      folder.parentId && folderIds.has(folder.parentId)
        ? folder.parentId
        : null;
    childrenByParent.set(parentId, [
      ...(childrenByParent.get(parentId) ?? []),
      folder,
    ]);
  }
  for (const file of files) {
    filesByFolder.set(file.workflowNodeId, [
      ...(filesByFolder.get(file.workflowNodeId) ?? []),
      file,
    ]);
  }
  for (const children of childrenByParent.values()) {
    children.sort(compareFolders);
  }
  for (const folderFiles of filesByFolder.values()) {
    folderFiles.sort((left, right) =>
      left.fileReference.localeCompare(right.fileReference, undefined, {
        numeric: true,
      })
    );
  }

  const rows: TreeRow[] = [];
  const visited = new Set<string>();
  const visit = (folder: ArchiveFileIndexFolder, depth: number) => {
    if (visited.has(folder.workflowNodeId)) {
      return;
    }
    visited.add(folder.workflowNodeId);
    rows.push({ kind: "folder", folder, depth });
    for (const file of filesByFolder.get(folder.workflowNodeId) ?? []) {
      rows.push({ kind: "file", file, depth: depth + 1 });
    }
    for (const child of childrenByParent.get(folder.workflowNodeId) ?? []) {
      visit(child, depth + 1);
    }
  };
  for (const root of childrenByParent.get(null) ?? []) {
    visit(root, 0);
  }
  for (const folder of [...folders].sort(compareFolders)) {
    visit(folder, 0);
  }
  for (const file of files.filter(
    (item) => !folderIds.has(item.workflowNodeId)
  )) {
    rows.push({ kind: "file", file, depth: 0 });
  }
  return rows;
}

function compareFolders(
  left: ArchiveFileIndexFolder,
  right: ArchiveFileIndexFolder
) {
  return (
    left.sortOrder - right.sortOrder ||
    left.code.localeCompare(right.code, undefined, { numeric: true })
  );
}

function renderTreeRow(row: TreeRow, index: number, copy: Copy) {
  if (row.kind === "folder") {
    const fill = "folder-fill";
    return [
      filledCell(
        fill,
        `#text(size: 6.7pt, weight: "semibold", fill: accent)[${typstText(copy.folder)}]`
      ),
      filledCell(
        fill,
        `#text(weight: "semibold")[${typstText(row.folder.code)}]`
      ),
      filledCell(fill, renderTreeName(row.depth, row.folder.title, true)),
      filledCell(fill, ""),
      filledCell(fill, ""),
      filledCell(fill, ""),
      filledCell(fill, ""),
      filledCell(fill, ""),
    ].join(",\n");
  }

  const { file } = row;
  const fill = index % 2 === 0 ? "white" : "row-tint";
  return [
    filledCell(
      fill,
      `#text(size: 6.7pt, fill: muted)[${typstText(copy.file)}]`
    ),
    filledCell(fill, typstText(file.fileReference)),
    filledCell(fill, renderTreeName(row.depth, file.fileName, false)),
    filledCell(fill, typstText(fileKindLabel(file.fileKind, copy))),
    filledCell(
      fill,
      `#align(right)[${typstText(formatFileSize(file.fileSize))}]`
    ),
    filledCell(
      fill,
      `#text(size: 6.8pt)[${typstText(formatSignoff(file.preparerSignoff))}]`
    ),
    filledCell(
      fill,
      `#text(size: 6.8pt)[${typstText(formatSignoff(file.reviewerSignoff))}]`
    ),
    filledCell(
      file.signoffStatus === "COMPLETE" ? "pass-fill" : fill,
      `#text(weight: "semibold", fill: ${file.signoffStatus === "COMPLETE" ? "accent" : "muted"})[${typstText(signoffStatusLabel(file.signoffStatus, copy))}]`
    ),
  ].join(",\n");
}

function renderIntegrityRow(file: ArchiveFileIndexFile, index: number) {
  const fill = index % 2 === 0 ? "white" : "row-tint";
  return [
    filledCell(fill, typstText(String(index + 1))),
    filledCell(fill, typstText(file.fileReference)),
    filledCell(fill, typstText(file.fileName)),
    filledCell(fill, `#text(size: 6.2pt)[${typstText(file.archivePath)}]`),
    filledCell(fill, typstText(file.sourceFileName ?? "-")),
    filledCell(
      fill,
      `#align(right)[${typstText(file.fileSize.toLocaleString("en-US"))}]`
    ),
    filledCell(fill, renderSha256(file.sha256)),
  ].join(",\n");
}

function renderTreeName(depth: number, value: string, folder: boolean) {
  const indentation = Math.min(depth, 8) * 3.5;
  const marker = folder
    ? `#box(width: 2.3mm, height: 1.6mm, baseline: 20%)[#rect(width: 100%, height: 100%, radius: 0.35mm, fill: accent-soft, stroke: 0.45pt + accent)]`
    : `#box(width: 2.4mm, height: 1.6mm, baseline: 20%)[#align(center + horizon)[#line(length: 100%, stroke: 0.65pt + rule-strong)]]`;
  return `#h(${indentation}mm)${marker}#h(1.5mm)#text(weight: "${folder ? "semibold" : "regular"}")[${typstText(value)}]`;
}

function renderSha256(value: string) {
  const lines = value.match(/.{1,32}/g) ?? [value];
  return `#text(font: mono-fonts, size: 6.2pt, fill: muted)[${lines
    .map((line) => typstText(line))
    .join("#linebreak()")}]`;
}

function filledCell(fill: string, content: string) {
  return `[#table.cell(fill: ${fill})[${content}]]`;
}

function renderEmptyTreeRow(copy: Copy) {
  return `[#table.cell(colspan: 8, fill: paper-tint, inset: 12pt)[#align(center)[#text(fill: muted)[${typstText(copy.empty)}]]]]`;
}

function renderEmptyIntegrityRow(copy: Copy) {
  return `[#table.cell(colspan: 7, fill: paper-tint, inset: 12pt)[#align(center)[#text(fill: muted)[${typstText(copy.empty)}]]]]`;
}

function archiveIndexCopy(zh: boolean) {
  return zh
    ? {
        eyebrow: "项目归档",
        title: "项目归档文件索引",
        shortTitle: "归档文件索引",
        description: "按项目目录层级列示本期归档文件及编制、复核签核情况。",
        footer: "系统生成的项目归档索引 · 内部使用",
        projectName: "项目名称",
        projectCode: "项目编号",
        clientName: "客户名称",
        yearEnd: "年结日",
        files: "归档文件",
        folders: "归档目录",
        warnings: "File Check 警告",
        fileCheck: "File Check 结论",
        fileCheckPassed: "通过",
        fileCheckFailed: "未通过",
        scopeNote:
          "归档范围仅包含本期底稿。上期底稿、临时文件、已删除附件和独立复核注释数据不包含在本归档包内；SmartForm 已转换为可阅读 PDF。",
        treeTitle: "归档目录与文件",
        treeNote: "缩进表示目录层级；每个目录和文件均占一行。",
        timezoneNote: "签核时间为 UTC",
        generatedAt: "生成时间",
        kind: "类型",
        code: "编号",
        name: "目录 / 文件名称",
        format: "文件类型",
        size: "大小",
        preparer: "编制签核",
        reviewer: "复核签核",
        result: "签核结论",
        folder: "目录",
        file: "文件",
        complete: "已完成",
        missingPreparer: "缺少编制",
        missingReviewer: "缺少复核",
        appendix: "附录",
        integrityTitle: "文件完整性校验",
        integrityDescription:
          "以下路径和 SHA-256 值用于核对归档包内文件的完整性。",
        number: "序号",
        fileReference: "文件编号",
        fileName: "归档文件名",
        archivePath: "归档路径",
        sourceFile: "源文件",
        bytes: "字节",
        spreadsheet: "工作簿",
        supporting: "支持性文件",
        smartFormPdf: "SmartForm (PDF)",
        empty: "暂无归档文件",
      }
    : {
        eyebrow: "PROJECT ARCHIVE",
        title: "Project Archive File Index",
        shortTitle: "Archive File Index",
        description:
          "Current-period archive files with directory hierarchy and preparation and review sign-offs.",
        footer: "System-generated project archive index · Internal use",
        projectName: "Project name",
        projectCode: "Project code",
        clientName: "Client name",
        yearEnd: "Year end",
        files: "Archived files",
        folders: "Archive folders",
        warnings: "File Check warnings",
        fileCheck: "File Check result",
        fileCheckPassed: "Passed",
        fileCheckFailed: "Failed",
        scopeNote:
          "The archive includes current-period workpapers only. Prior workpapers, temporary files, deleted attachments, and standalone review-note data are excluded; Smart Forms are exported as readable PDFs.",
        treeTitle: "Archive folders and files",
        treeNote:
          "Indentation represents directory depth; every folder and file occupies one row.",
        timezoneNote: "Sign-off times shown in UTC",
        generatedAt: "Generated",
        kind: "Item",
        code: "Reference",
        name: "Folder / file name",
        format: "File type",
        size: "Size",
        preparer: "Prepared by",
        reviewer: "Reviewed by",
        result: "Sign-off",
        folder: "Folder",
        file: "File",
        complete: "Complete",
        missingPreparer: "Missing P",
        missingReviewer: "Missing R",
        appendix: "APPENDIX",
        integrityTitle: "File integrity details",
        integrityDescription:
          "Archive paths and SHA-256 values support verification of files in the archive package.",
        number: "No.",
        fileReference: "File reference",
        fileName: "Archived file name",
        archivePath: "Archive path",
        sourceFile: "Source file",
        bytes: "Bytes",
        spreadsheet: "Spreadsheet",
        supporting: "Supporting file",
        smartFormPdf: "Smart Form (PDF)",
        empty: "No archived files",
      };
}

function fileKindLabel(value: string, copy: Copy) {
  if (value === "SPREADSHEET") {
    return copy.spreadsheet;
  }
  if (value === "SUPPORTING") {
    return copy.supporting;
  }
  if (value === "SMART_FORM_EXPORT") {
    return copy.smartFormPdf;
  }
  return value;
}

function signoffStatusLabel(
  value: ArchiveFileIndexFile["signoffStatus"],
  copy: Copy
) {
  if (value === "COMPLETE") {
    return copy.complete;
  }
  if (value === "MISSING_PREPARER") {
    return copy.missingPreparer;
  }
  return copy.missingReviewer;
}

function formatSignoff(signoff: ArchiveFileIndexSignoff | undefined) {
  if (!signoff) {
    return "-";
  }
  return `${signoff.name} · ${formatDateTime(signoff.signedAt).replace(" UTC", "")}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-US")} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function typstText(value: string) {
  return `#text(${JSON.stringify(value)})`;
}

function formatTypstCompileError(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const diagnostic = value as {
      compilationStatus?: unknown;
      kind?: unknown;
      shortDiagnostics?: unknown;
    };
    const details = {
      compilationStatus: diagnostic.compilationStatus,
      kind: diagnostic.kind,
      shortDiagnostics: diagnostic.shortDiagnostics,
    };
    const serializedDetails = JSON.stringify(details);
    if (serializedDetails !== "{}") {
      return serializedDetails;
    }
  }
  return inspect(value, { depth: 8, showHidden: true });
}
