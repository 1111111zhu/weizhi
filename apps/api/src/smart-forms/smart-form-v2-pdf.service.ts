import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  compileSmartFormV2Definition,
  isSmartFormV2ExpressionTrue,
  resolveSmartFormV2ConditionalBranch,
  validateSmartFormV2Response,
} from "@project-wing/shared";
import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2Definition,
  SmartFormV2FieldAnswer,
  SmartFormV2FieldDefinition,
  SmartFormV2FieldValue,
  SmartFormV2FixedSheetRow,
  SmartFormV2NumberingRule,
  SmartFormV2Response,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  SmartFormV2RichTextInline,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  pdfNotePlainText,
  pdfNoteRichContent,
} from "@project-wing/shared/pdf-rich-note";
import type { PdfReviewNote } from "@project-wing/shared/pdf-rich-note";
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
} from "pdf-lib";

export type SmartFormV2PdfInput = {
  definition: SmartFormV2Definition | SmartFormV2CompiledDefinition;
  response?: SmartFormV2Response;
  locale?: string;
  fileName?: string;
  documentVersion?: string | number;
  generatedAt?: Date | string;
  engagementDetails?: SmartFormV2PdfEngagementDetails;
  signoffs?: SmartFormV2PdfSignoff[];
  reviewQuestions?: SmartFormV2PdfReviewQuestion[];
};

export type SmartFormV2PdfSignoff = {
  type: "PREPARER" | "REVIEWER";
  userName: string;
  signedAt: Date | string;
};

export type SmartFormV2PdfReviewQuestion = {
  id: string;
  smartFormNodeId?: string | null;
  smartFormRowId?: string | null;
  smartFormTargetLabel?: string | null;
  body: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  createdBy?: { name?: string | null; email?: string | null } | null;
  assignedTo?: { name?: string | null; email?: string | null } | null;
  repliedBy?: { name?: string | null; email?: string | null } | null;
  replyBody?: string | null;
  repliedAt?: Date | string | null;
  messages?: {
    id: string;
    messageType: string;
    body: string;
    createdAt: Date | string;
    author?: { name?: string | null; email?: string | null } | null;
    images?: {
      id?: string;
      originalName?: string | null;
      fileName: string;
    }[];
    references?: {
      workingPaper?: {
        id?: string;
        code?: string | null;
        title?: string | null;
      } | null;
    }[];
  }[];
};

type SmartFormV2PdfAnchor = {
  documentTitle?: boolean;
  nodeId: string;
  rowId?: string;
  pageIndex: number;
  x: number;
  y: number;
};

export type SmartFormV2PdfEngagementDetails = {
  clientName?: string;
  engagementCode?: string;
  financialStatementDate?: Date | string;
};

type SmartFormV2PdfLabels = {
  status: string;
  complete: string;
  incomplete: string;
  notProvided: string;
  required: string;
  clientName: string;
  engagementCode: string;
  financialStatementDate: string;
  preparerSignoff: string;
  approverSignoff: string;
  pendingSignoff: string;
};

const ZH_LABELS: SmartFormV2PdfLabels = {
  status: "状态",
  complete: "已完成",
  incomplete: "待完善",
  notProvided: "未填写",
  required: "必填",
  clientName: "客户名称",
  engagementCode: "业务编号",
  financialStatementDate: "财务报表日期",
  preparerSignoff: "编制签核人",
  approverSignoff: "审批签核人",
  pendingSignoff: "待签核",
};
const EN_LABELS: SmartFormV2PdfLabels = {
  status: "Status",
  complete: "Complete",
  incomplete: "Incomplete",
  notProvided: "Not provided",
  required: "Required",
  clientName: "Client Name",
  engagementCode: "Engagement Code",
  financialStatementDate: "Financial Statement Date",
  preparerSignoff: "Prepared and signed by",
  approverSignoff: "Approved and signed by",
  pendingSignoff: "Pending",
};

@Injectable()
export class SmartFormV2PdfService {
  async renderSmartFormV2Pdf(input: SmartFormV2PdfInput): Promise<Buffer> {
    await Promise.resolve();
    const definition = compileSmartFormV2Definition(
      input.definition,
      STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
    );
    const locale =
      input.locale ??
      input.response?.responseLocale ??
      definition.i18n.defaultLocale;
    const targetLabels = collectReviewTargetLabels(definition, locale);
    const reviewQuestions = (input.reviewQuestions ?? []).map((question) => ({
      ...question,
      smartFormTargetLabel:
        targetLabels.get(
          reviewTargetKey(
            question.smartFormNodeId ?? "",
            question.smartFormRowId ?? undefined
          )
        ) ?? question.smartFormTargetLabel,
    }));
    const compiled = compileTypstPdf(
      renderSmartFormV2TypstSource({
        ...input,
        definition,
        locale,
        reviewQuestions,
      })
    );
    return addSmartFormV2CommentAnnotations(
      compiled.pdf,
      collectSmartFormV2Comments(definition, input.response, locale),
      reviewQuestions,
      compiled.anchors,
      locale
    );
  }
}

export type SmartFormV2PdfComment = {
  title: string;
  content: string;
  document?: SmartFormV2RichTextDocument;
};

// Print + Locked + LockedContents. Review comments must remain selectable so
// Readers can inspect the complete text, but the exported audit evidence must
// Not be movable or editable in annotation-aware PDF viewers.
const SMART_FORM_PDF_ANNOTATION_FLAGS = 4 + 128 + 512;
// Internal target keys contain a NUL separator, so this cannot collide with a node ID.
const DOCUMENT_REVIEW_TARGET = "document-review";

export async function addSmartFormV2CommentAnnotations(
  pdf: Buffer,
  comments: SmartFormV2PdfComment[],
  reviewQuestions: SmartFormV2PdfReviewQuestion[] = [],
  anchors: SmartFormV2PdfAnchor[] = [],
  locale = "zh-CN"
): Promise<Buffer> {
  if (comments.length === 0 && reviewQuestions.length === 0) {
    return pdf;
  }
  const document = await PDFDocument.load(pdf);
  const pages = document.getPages();
  if (pages.length === 0) {
    return pdf;
  }
  const commentsPerPage = Math.max(
    1,
    Math.ceil(comments.length / pages.length)
  );

  comments.forEach((comment, index) => {
    const pageIndex = Math.min(
      pages.length - 1,
      Math.floor(index / commentsPerPage)
    );
    const page = assertPresentValue(pages[pageIndex]);
    const indexOnPage = index - pageIndex * commentsPerPage;
    const { width, height } = page.getSize();
    const size = 18;
    const x = width - size - 8;
    const y = Math.max(28, height - 56 - indexOnPage * (size + 8));
    const annotation = document.context.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Text"),
      Rect: document.context.obj([
        PDFNumber.of(x),
        PDFNumber.of(y),
        PDFNumber.of(x + size),
        PDFNumber.of(y + size),
      ]),
      Contents: PDFHexString.fromText(comment.content),
      Subj: PDFHexString.fromText(comment.title),
      ...(comment.document
        ? {
            RC: PDFHexString.fromText(pdfNoteRichContent(comment.document)),
            EPDFCustom: PDFHexString.fromText(
              JSON.stringify({
                projectWingNote: { version: 1, document: comment.document },
              })
            ),
          }
        : {}),
      Name: PDFName.of("Comment"),
      C: document.context.obj([
        PDFNumber.of(1),
        PDFNumber.of(0.82),
        PDFNumber.of(0),
      ]),
      F: PDFNumber.of(SMART_FORM_PDF_ANNOTATION_FLAGS),
      Open: false,
    });
    const annotationRef = document.context.register(annotation);
    const existing = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    const annotations = existing ?? document.context.obj([]);
    annotations.push(annotationRef);
    page.node.set(PDFName.of("Annots"), annotations);
  });

  const anchorByTarget = new Map(
    anchors
      .filter((anchor) => !anchor.documentTitle)
      .map((anchor) => [reviewTargetKey(anchor.nodeId, anchor.rowId), anchor])
  );
  const groups = new Map<string, SmartFormV2PdfReviewQuestion[]>();
  reviewQuestions.forEach((question) => {
    const key = question.smartFormNodeId
      ? reviewTargetKey(
          question.smartFormNodeId,
          question.smartFormRowId ?? undefined
        )
      : DOCUMENT_REVIEW_TARGET;
    const group = groups.get(key);
    if (group) {
      group.push(question);
    } else {
      groups.set(key, [question]);
    }
  });
  const notes = [...groups.entries()]
    .map(([targetKey, questions]) => {
      const documentReview = targetKey === DOCUMENT_REVIEW_TARGET;
      const anchor = documentReview
        ? anchors.find((item) => item.documentTitle)
        : anchorByTarget.get(targetKey);
      const pageIndex = Math.min(
        pages.length - 1,
        Math.max(0, anchor?.pageIndex ?? 0)
      );
      const page = assertPresentValue(pages[pageIndex]);
      return {
        questions,
        documentReview,
        pageIndex,
        x:
          documentReview && anchor
            ? Math.max(6, Math.min(page.getWidth() - 30, anchor.x + 6))
            : page.getWidth() - 30,
        y: Math.max(
          28,
          Math.min(
            page.getHeight() - 46,
            anchor ? page.getHeight() - anchor.y - 9 : page.getHeight() - 56
          )
        ),
      };
    })
    .sort((a, b) => a.pageIndex - b.pageIndex || b.y - a.y);
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const titleNote = notes.find(
      (note) => note.pageIndex === pageIndex && note.documentReview
    );
    const onPage = notes.filter(
      (note) => note.pageIndex === pageIndex && !note.documentReview
    );
    // Keep the document-level entry fixed at the title; missing row anchors
    // must not put their fallback icon on top of it.
    if (titleNote) {
      for (const note of onPage) {
        if (
          Math.abs(note.x - titleNote.x) < 24 &&
          Math.abs(note.y - titleNote.y) < 24
        ) {
          note.y = titleNote.y - 24;
        }
      }
    }
    // Keep reading order and one fixed margin column. Move only as far as
    // needed to clear the native icon, then backfill upwards at the page foot.
    for (let index = 1; index < onPage.length; index += 1) {
      onPage[index].y = Math.min(onPage[index].y, onPage[index - 1].y - 24);
    }
    if (onPage.length && onPage[onPage.length - 1].y < 28) {
      onPage[onPage.length - 1].y = 28;
      for (let index = onPage.length - 2; index >= 0; index -= 1) {
        onPage[index].y = Math.max(onPage[index].y, onPage[index + 1].y + 24);
      }
    }
  }
  notes.forEach(({ questions, pageIndex, x, y }, index) => {
    questions.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.id.localeCompare(b.id)
    );
    const question = assertPresentValue(questions[0]);
    const page = assertPresentValue(pages[pageIndex]);
    const size = 18;
    const formatted = formatReviewQuestionGroup(questions, locale);
    const status = questions.some((item) => item.status === "OPEN")
      ? "OPEN"
      : questions.some((item) => item.status === "REPLIED")
        ? "REPLIED"
        : "CLEARED";
    const annotation = document.context.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Text"),
      Rect: document.context.obj([
        PDFNumber.of(x),
        PDFNumber.of(y),
        PDFNumber.of(x + size),
        PDFNumber.of(y + size),
      ]),
      Contents: PDFHexString.fromText(formatted.content),
      EPDFCustom: PDFHexString.fromText(
        JSON.stringify({ projectWingReview: formatted.review })
      ),
      T: PDFHexString.fromText(formatted.title),
      Subj: PDFHexString.fromText(formatted.title),
      NM: PDFHexString.fromText(question.id || `smartform-q-${index + 1}`),
      M: PDFHexString.fromText(
        toPdfAnnotationDate(
          questions.reduce(
            (latest, item) =>
              new Date(item.updatedAt ?? item.createdAt).getTime() >
              new Date(latest).getTime()
                ? (item.updatedAt ?? item.createdAt)
                : latest,
            question.updatedAt ?? question.createdAt
          )
        )
      ),
      Name: PDFName.of("Comment"),
      C: document.context.obj(reviewQuestionColor(status)),
      F: PDFNumber.of(SMART_FORM_PDF_ANNOTATION_FLAGS),
      Open: false,
    });
    const annotationRef = document.context.register(annotation);
    const existing = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    const annotations = existing ?? document.context.obj([]);
    annotations.push(annotationRef);
    page.node.set(PDFName.of("Annots"), annotations);
  });

  return Buffer.from(await document.save());
}

export function renderSmartFormV2TypstSource(input: {
  definition: SmartFormV2CompiledDefinition;
  response?: SmartFormV2Response;
  locale?: string;
  fileName?: string;
  documentVersion?: string | number;
  generatedAt?: Date | string;
  engagementDetails?: SmartFormV2PdfEngagementDetails;
  signoffs?: SmartFormV2PdfSignoff[];
  reviewQuestions?: SmartFormV2PdfReviewQuestion[];
}) {
  const locale =
    input.locale ??
    input.response?.responseLocale ??
    input.definition.i18n.defaultLocale;
  const labels = locale.toLowerCase().startsWith("zh") ? ZH_LABELS : EN_LABELS;
  const title =
    localizedText(input.definition.title, locale) ||
    input.fileName ||
    "SmartForm V2";
  const valid = input.response
    ? validateSmartFormV2Response(input.definition, input.response).success
    : false;
  const engagementDetails = renderEngagementDetails(
    input.engagementDetails,
    labels,
    locale,
    valid
  );
  const signoffs = renderSignoffs(input.signoffs ?? [], labels, locale);
  const hasDocumentReview = (input.reviewQuestions ?? []).some(
    (question) => !question.smartFormNodeId
  );
  const reviewTargets = new Set(
    (input.reviewQuestions ?? [])
      .filter((question) => Boolean(question.smartFormNodeId))
      .map((question) =>
        reviewTargetKey(
          assertPresentValue(question.smartFormNodeId),
          question.smartFormRowId ?? undefined
        )
      )
  );

  return `#import "@preview/easy-paper:0.2.2": *

#let serif-fonts = ("Noto Serif SC", "Noto Serif CJK SC", "Noto Serif", "Source Han Serif SC", "Liberation Serif", "Times New Roman", "SimSun")
#let sans-fonts = ("Microsoft YaHei", "SimHei", "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans", "Source Han Sans SC", "Liberation Sans", "Arial")
#let mono-fonts = ("Liberation Mono", "Noto Sans Mono", "Consolas")
#let ink = rgb("#17202a")
#let body-ink = rgb("#27323b")
#let muted = rgb("#374151")
#let faint = rgb("#4b5563")
#let rule = rgb("#a9b2bc")
#let light-rule = rgb("#dfe4e9")
#let header-fill = rgb("#eaf0f5")
#let accent = rgb("#2f5977")

#show: project.with(
  title: "",
  author: "",
  date: none,
  config: (
    text-size: 10.5pt,
    title-size: 18pt,
    title1-size: 15pt,
    title2-size: 14pt,
    title3-size: 12pt,
    title-font: sans-fonts,
    author-font: sans-fonts,
    body-font: serif-fonts,
    heading-font: sans-fonts,
    caption-font: serif-fonts,
    header-font: serif-fonts,
    strong-font: serif-fonts,
    emph-font: serif-fonts,
    raw-font: mono-fonts,
    spacing: 0.55em,
    leading: 0.62em,
    indent: 0em,
    table-stroke: 0.8pt,
    table-header-stroke: 0.45pt,
    page-numbering: "1",
    page-number-align: center,
  ),
)

#set text(font: serif-fonts, size: 10.5pt, fill: body-ink, lang: ${typstString(locale.toLowerCase().startsWith("zh") ? "zh" : "en")})
#set par(first-line-indent: 0em, leading: 0.62em, spacing: 0.55em, justify: false)
#set heading(numbering: none)
#set document(title: ${typstString(title)})
#align(center)[${hasDocumentReview ? renderDocumentReviewAnchor(title) : ""}#text(font: sans-fonts, size: 18pt, weight: "regular", fill: ink, ${typstString(title)})]
#v(0.5em)
#show heading: it => {
  let heading-size = if it.level == 1 { 15pt } else if it.level == 2 { 14pt } else { 12pt }
  let heading-align = if it.level == 1 { center } else { left }
  align(heading-align, block(above: 1.3em, below: 0.8em)[
    #text(font: sans-fonts, size: heading-size, weight: "regular", fill: ink, it.body)
  ])
}

${signoffs}
${engagementDetails}
#v(2em)

${renderNodes(input.definition.children, input.definition, input.response, locale, labels, [], reviewTargets)}
`;
}

function renderNodes(
  nodes: SmartFormV2CompiledDefinition["children"],
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response | undefined,
  locale: string,
  labels: SmartFormV2PdfLabels,
  parentPath: number[],
  reviewTargets: ReadonlySet<string>
): string {
  let headingIndex = 0;
  return nodes
    .map((node) => {
      const isHeading = node.kind === "section" || node.kind === "group";
      const path = isHeading ? [...parentPath, headingIndex] : parentPath;
      if (isHeading) {
        headingIndex += 1;
      }
      return renderNode(
        node,
        definition,
        response,
        locale,
        labels,
        path,
        reviewTargets
      );
    })
    .join("\n");
}

function renderNode(
  node: SmartFormV2CompiledDefinition["children"][number],
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response | undefined,
  locale: string,
  labels: SmartFormV2PdfLabels,
  path: number[],
  reviewTargets: ReadonlySet<string>
): string {
  if (
    response &&
    !isSmartFormV2ExpressionTrue(definition, response, node.visibleWhen)
  ) {
    return "";
  }
  if (node.kind === "section" || node.kind === "group") {
    const heading = localizedText(node.title, locale);
    const level = Math.min(3, Math.max(1, path.length));
    const indent = path.length > 1 && path.length <= 3 ? 3 : 0;
    const sectionGap = level === 1 ? "#v(1em)\n" : "";
    const description = localizedText(node.description, locale);
    return `
${renderReviewAnchor(reviewTargets, node.id)}
#block(width: 100%, breakable: true, inset: (left: ${indent}mm))[
  ${sectionGap}#heading(level: ${level}, numbering: none)[${typstText(heading)}]
  ${description ? `#text(size: 9pt, fill: faint, ${typstString(description)})\n#v(1.6mm)` : ""}
  ${renderNodes(node.children, definition, response, locale, labels, path, reviewTargets)}
]
`;
  }
  if (node.kind === "content") {
    return `\n${renderReviewAnchor(reviewTargets, node.id)}\n#block(width: 100%)[${renderRichText(node.content, locale)}]\n`;
  }
  if (node.kind === "conditional") {
    const question = renderField(
      node.branchQuestion.id,
      node.branchQuestion.label,
      node.branchQuestion.value,
      response?.fields[node.branchQuestion.id],
      true,
      locale,
      labels,
      reviewTargets
    );
    if (!response) {
      return question;
    }
    const branch = resolveSmartFormV2ConditionalBranch(
      definition,
      response,
      node
    );
    const activeChildren =
      branch.type === "branch"
        ? (node.branches.find((candidate) => candidate.id === branch.branchId)
            ?.children ?? [])
        : branch.type === "otherwise"
          ? node.otherwise.children
          : [];
    return `${question}\n${renderNodes(activeChildren, definition, response, locale, labels, path, reviewTargets)}`;
  }
  if (node.kind === "field") {
    const required =
      node.required === true ||
      Boolean(
        node.requiredWhen &&
        response &&
        isSmartFormV2ExpressionTrue(definition, response, node.requiredWhen)
      );
    return renderField(
      node.id,
      node.label,
      node.value,
      response?.fields[node.id],
      required,
      locale,
      labels,
      reviewTargets
    );
  }
  if (node.kind === "sheet") {
    return renderSheet(
      node,
      definition,
      response,
      locale,
      labels,
      reviewTargets
    );
  }
  return "";
}

function renderField(
  nodeId: string,
  label: { values: Record<string, SmartFormV2RichTextDocument> },
  definition: SmartFormV2FieldDefinition,
  answer: SmartFormV2FieldAnswer | undefined,
  required: boolean | undefined,
  locale: string,
  labels: SmartFormV2PdfLabels,
  reviewTargets: ReadonlySet<string>
) {
  const value = resolveAnswer(answer, locale);
  return `
#v(2mm)
${renderReviewAnchor(reviewTargets, nodeId)}
#block(breakable: false)[
  #grid(columns: (30%, 1fr), column-gutter: 4mm, align: (left, left),
    [#text(font: sans-fonts, size: 9pt, weight: "regular", fill: muted, ${typstString(localizedText(label, locale))})${required ? ` #text(size: 7.5pt, fill: accent, ${typstString(`* ${labels.required}`)})` : ""}],
    [${renderFieldValue(definition, value, locale, labels)}],
  )
  #v(1.3mm)
  #line(length: 100%, stroke: 0.3pt + light-rule)
]
`;
}

function renderSheet(
  sheet: SmartFormV2SheetNode,
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response | undefined,
  locale: string,
  labels: SmartFormV2PdfLabels,
  reviewTargets: ReadonlySet<string>
) {
  const columns = sheet.columns.flatMap(flattenColumns);
  const answer = response?.sheets[sheet.id];
  const rows =
    sheet.rows.mode === "fixed"
      ? flattenRowsWithNumbers(sheet.rows.items, sheet.rows.numbering).map(
          ({ row, number }) => ({
            source: row,
            number,
            answer: answer?.rows.find(
              (item) => (item.sourceRowId ?? item.id) === row.id
            ),
          })
        )
      : (answer?.rows ?? []).map((row) => ({
          source: undefined,
          answer: row,
        }));
  const headerCells = columns
    .map(
      (column) =>
        `[#text(font: sans-fonts, size: 8pt, weight: "regular", fill: ink, ${typstString(localizedText(column.header, locale))})]`
    )
    .join(",\n");
  const bodyCells = rows
    .map((row) => {
      const { source } = row;
      const number = "number" in row ? row.number : "";
      const answerRow = row.answer;
      const rowId = source?.id ?? answerRow?.sourceRowId ?? answerRow?.id;
      const rowAnchor = rowId
        ? renderReviewAnchor(reviewTargets, sheet.id, rowId)
        : "";
      if (source?.role === "group") {
        return `table.cell(colspan: ${columns.length}, inset: (x: 1.8mm, y: 1.3mm))[${rowAnchor}#text(font: sans-fonts, weight: "regular", fill: ink, ${typstString(formatRowLabel(source, locale, number))})]`;
      }
      return columns
        .map((column, columnIndex) => {
          const anchor = columnIndex === 0 ? rowAnchor : "";
          if (column.cell.kind === "rowLabel") {
            return `[${anchor}${typstText(formatRowLabel(source, locale, number))}]`;
          }
          const override = source?.cells?.[column.id];
          if (override?.kind === "empty") {
            return `[${anchor}]`;
          }
          if (override?.kind === "content") {
            return `[${anchor}${renderRichText(override.content, locale)}]`;
          }
          if (
            response &&
            override?.kind === "field" &&
            !isSmartFormV2ExpressionTrue(
              definition,
              response,
              override.visibleWhen
            )
          ) {
            return `[${anchor}]`;
          }
          return `[${anchor}${renderFieldValue(column.cell.field.value, resolveAnswer(answerRow?.cells[column.id], locale), locale, labels)}]`;
        })
        .join(",\n");
    })
    .join(",\n");
  const title = localizedText(sheet.title, locale);
  const description = localizedText(sheet.description, locale);
  return `
#v(3.6mm)
${renderReviewAnchor(reviewTargets, sheet.id)}
${title ? `#text(font: sans-fonts, size: 12pt, weight: "regular", fill: ink, ${typstString(title)})\n` : ""}
${description ? `#text(size: 9pt, fill: faint, ${typstString(description)})\n#v(1.4mm)` : ""}
#table(
  columns: (${columns.map((column) => typstColumnWidth(column)).join(", ")}),
  inset: (x: 1.8mm, y: 1.7mm),
  table.header(${headerCells}),
  ${bodyCells || columns.map(() => "[]").join(",")},
)
`;
}

function collectSmartFormV2Comments(
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response | undefined,
  locale: string
): SmartFormV2PdfComment[] {
  if (!response) {
    return [];
  }
  const comments: SmartFormV2PdfComment[] = [];
  const visit = (nodes: SmartFormV2CompiledDefinition["children"]) => {
    for (const node of nodes) {
      if (node.kind === "section" || node.kind === "group") {
        visit(node.children);
        continue;
      }
      if (node.kind === "conditional") {
        const branch = resolveSmartFormV2ConditionalBranch(
          definition,
          response,
          node
        );
        if (branch.type === "branch") {
          visit(
            node.branches.find((candidate) => candidate.id === branch.branchId)
              ?.children ?? []
          );
        } else if (branch.type === "otherwise") {
          visit(node.otherwise.children);
        }
        continue;
      }
      if (node.kind !== "sheet") {
        continue;
      }
      const commentColumnIds = node.columns
        .flatMap(flattenColumns)
        .filter((column) => {
          const header = localizedText(column.header, locale)
            .trim()
            .toLowerCase();
          return (
            column.id === "comments" ||
            header === "comments" ||
            header === "comment" ||
            header === "notes" ||
            header === "note" ||
            header === "备注"
          );
        })
        .map((column) => column.id);
      if (commentColumnIds.length === 0) {
        continue;
      }

      const answerRows = response.sheets[node.id]?.rows ?? [];
      const rows =
        node.rows.mode === "fixed"
          ? flattenRowsWithNumbers(node.rows.items, node.rows.numbering).map(
              ({ row, number }) => ({
                label: formatRowLabel(row, locale, number),
                answer: answerRows.find(
                  (candidate) =>
                    (candidate.sourceRowId ?? candidate.id) === row.id
                ),
              })
            )
          : answerRows.map((answer, index) => ({
              label: String(index + 1),
              answer,
            }));
      const sheetTitle = localizedText(node.title, locale);
      for (const row of rows) {
        if (!row.answer) {
          continue;
        }
        for (const columnId of commentColumnIds) {
          const value = resolveAnswer(row.answer.cells[columnId], locale);
          const document =
            value?.type === "richText" ? value.document : undefined;
          const content = document
            ? pdfNotePlainText(document)
            : smartFormFieldValuePlainText(value);
          if (!content) {
            continue;
          }
          comments.push({
            title: [sheetTitle, row.label].filter(Boolean).join(" - "),
            content,
            document,
          });
        }
      }
    }
  };

  visit(definition.children);
  return comments;
}

function smartFormFieldValuePlainText(
  value: SmartFormV2FieldValue | undefined
) {
  if (!value) {
    return "";
  }
  if (value.type === "richText") {
    return richTextPlainText(value.document).trim();
  }
  if (value.type === "text") {
    return value.text.trim();
  }
  if (value.type === "date") {
    return value.value.trim();
  }
  if (value.type === "number") {
    return value.decimal.trim();
  }
  if (value.type === "attachment") {
    return value.attachments
      .map(
        (attachment) => attachment.fileNameSnapshot ?? attachment.attachmentId
      )
      .join("; ")
      .trim();
  }
  if (value.type === "reference") {
    return value.references
      .map((reference) => reference.labelSnapshot ?? reference.targetId)
      .join("; ")
      .trim();
  }
  return value.selectedOptionIds.join("; ").trim();
}

function renderFieldValue(
  definition: SmartFormV2FieldDefinition,
  value: SmartFormV2FieldValue | undefined,
  locale: string,
  labels: SmartFormV2PdfLabels
) {
  if (!value) {
    return `#text(size: 8pt, fill: faint, style: "italic", ${typstString(labels.notProvided)})`;
  }
  switch (value.type) {
    case "choice": {
      if (definition.type !== "choice") {
        return typstText(labels.notProvided);
      }
      const selected = new Set(value.selectedOptionIds);
      const selectedLabels = definition.options
        .filter((option) => selected.has(option.id))
        .map((option) => localizedText(option.label, locale));
      return selectedLabels.length > 0
        ? typstText(
            selectedLabels.join(
              locale.toLowerCase().startsWith("zh") ? "；" : "; "
            )
          )
        : typstText(labels.notProvided);
    }
    case "text": {
      return renderMultilineText(value.text, labels);
    }
    case "richText": {
      return renderRichTextDocument(value.document);
    }
    case "attachment": {
      return value.attachments.length > 0
        ? value.attachments
            .map((attachment) =>
              typstText(attachment.fileNameSnapshot ?? attachment.attachmentId)
            )
            .join(" #h(2mm) ")
        : typstText(labels.notProvided);
    }
    case "reference": {
      return value.references.length > 0
        ? value.references
            .map((reference) =>
              typstText(reference.labelSnapshot ?? reference.targetId)
            )
            .join("; ")
        : typstText(labels.notProvided);
    }
    case "date": {
      return typstText(value.value);
    }
    case "number": {
      return typstText(value.decimal);
    }

    default: {
      return "";
    }
  }
}

function renderRichText(
  value: { values: Record<string, SmartFormV2RichTextDocument> },
  locale: string
) {
  const document = value.values[locale] ?? Object.values(value.values)[0];
  return document ? renderRichTextDocument(document) : "";
}

function renderRichTextDocument(document: SmartFormV2RichTextDocument) {
  return document.content.map((block) => renderRichTextBlock(block)).join("\n");
}

function renderRichTextBlock(block: SmartFormV2RichTextBlock): string {
  switch (block.type) {
    case "paragraph": {
      return `#text(size: 10pt)[${renderInlines(block.content)}]`;
    }
    case "heading": {
      return `#text(font: sans-fonts, size: ${Math.max(10, 15 - block.level)}pt, weight: "regular", fill: ink)[${renderInlines(block.content)}]`;
    }
    case "blockquote": {
      return `#block(stroke: (left: 0.8pt + rule), inset: (left: 3mm))[${block.content.map((child) => renderRichTextBlock(child)).join("\n")}]`;
    }
    case "bulletList": {
      return block.items
        .map(
          (item) =>
            `#grid(columns: (4mm, 1fr), [#text(fill: muted, "•")], [${item.content.map((child) => renderRichTextBlock(child)).join("\n")}])`
        )
        .join("\n");
    }
    case "orderedList": {
      return block.items
        .map(
          (item, index) =>
            `#grid(columns: (4mm, 1fr), [#text(fill: muted, ${typstString(`${index + 1}.`)})], [${item.content.map((child) => renderRichTextBlock(child)).join("\n")}])`
        )
        .join("\n");
    }
    case "table": {
      const width = Math.max(1, ...block.rows.map((row) => row.cells.length));
      const columnTracks = Array.from({ length: width }, () => "1fr").join(
        ", "
      );
      const cells = block.rows.flatMap((row) =>
        row.cells.map(
          (cell) =>
            `[${cell.content.map((child) => renderRichTextBlock(child)).join("\n")}]`
        )
      );
      return `#table(columns: (${columnTracks}), inset: 1.2mm, ${cells.join(",")})`;
    }
    case "embed": {
      return typstText(block.labelSnapshot ?? block.entityId);
    }

    default: {
      return "";
    }
  }
}

function renderInlines(inlines: SmartFormV2RichTextInline[]) {
  return inlines
    .map((inline) => {
      if (inline.type === "hardBreak") {
        return "#linebreak()";
      }
      if (inline.type === "entityReference") {
        return typstText(inline.labelSnapshot ?? inline.entityId);
      }
      let output = typstText(inline.text);
      const marks = inline.marks ?? [];
      for (let index = marks.length - 1; index >= 0; index -= 1) {
        const mark = marks[index];
        if (!mark) {
          continue;
        }
        if (mark.type === "bold") {
          output = `#strong[${output}]`;
        }
        if (mark.type === "italic") {
          output = `#emph[${output}]`;
        }
        if (mark.type === "underline") {
          output = `#underline[${output}]`;
        }
        if (mark.type === "strike") {
          output = `#strike[${output}]`;
        }
        if (mark.type === "code") {
          output = `#box(fill: header-fill, inset: (x: 0.8mm, y: 0.2mm), radius: 0.6pt)[${output}]`;
        }
        if (mark.type === "link") {
          output = `#link(${typstString(mark.href)})[${output}]`;
        }
      }
      return output;
    })
    .join("");
}

function resolveAnswer(
  answer: SmartFormV2FieldAnswer | undefined,
  locale: string
): SmartFormV2FieldValue | undefined {
  if (!answer) {
    return undefined;
  }
  if (answer.type !== "localized") {
    return answer;
  }
  return answer.values[locale] ?? Object.values(answer.values)[0];
}

function flattenColumns(
  column: SmartFormV2SheetNode["columns"][number]
): SmartFormV2SheetLeafColumn[] {
  return column.kind === "column"
    ? [column]
    : column.children.flatMap(flattenColumns);
}

function flattenRowsWithNumbers(
  rows: SmartFormV2FixedSheetRow[],
  numbering: SmartFormV2NumberingRule | undefined,
  depth = 0,
  parentNumber = ""
): { row: SmartFormV2FixedSheetRow; number: string }[] {
  return rows.flatMap((row, index) => {
    const rule = numberingForDepth(numbering, depth);
    const ownNumber = rule?.enabled
      ? `${rule.prefix ?? ""}${formatOrdinal((rule.startAt ?? 1) + index, rule.style)}${rule.suffix ?? ""}`
      : "";
    const number = parentNumber
      ? `${parentNumber}${rule?.separator ?? ""}${ownNumber}`
      : ownNumber;
    return [
      { row, number },
      ...(row.children?.length
        ? flattenRowsWithNumbers(row.children, numbering, depth + 1, number)
        : []),
    ];
  });
}

function numberingForDepth(
  numbering: SmartFormV2NumberingRule | undefined,
  depth: number
) {
  let current = numbering;
  for (let index = 0; index < depth; index += 1) {
    current = current?.child;
  }
  return current;
}

function formatOrdinal(
  value: number,
  style: SmartFormV2NumberingRule["style"]
) {
  if (style === "decimal") {
    return String(value);
  }
  if (style === "lower-alpha" || style === "upper-alpha") {
    let remaining = value;
    let output = "";
    while (remaining > 0) {
      remaining -= 1;
      output = String.fromCodePoint(97 + (remaining % 26)) + output;
      remaining = Math.floor(remaining / 26);
    }
    return style === "upper-alpha" ? output.toUpperCase() : output;
  }
  const tokens: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = value;
  let output = "";
  for (const [unit, token] of tokens) {
    while (remaining >= unit) {
      output += token;
      remaining -= unit;
    }
  }
  return style === "upper-roman" ? output : output.toLowerCase();
}

function formatRowLabel(
  row: SmartFormV2FixedSheetRow | undefined,
  locale: string,
  number = ""
) {
  const label = rowLabel(row, locale);
  return number && label ? `${number} ${label}` : number || label;
}

function rowLabel(row: SmartFormV2FixedSheetRow | undefined, locale: string) {
  return row?.label ? localizedText(row.label, locale) : "";
}

function typstColumnWidth(column: SmartFormV2SheetLeafColumn) {
  if (typeof column.width === "string") {
    return column.width.replace("%", "fr");
  }
  if (typeof column.width === "number") {
    return `${Math.max(column.width, 20)}pt`;
  }
  return "1fr";
}

function renderEngagementDetails(
  details: SmartFormV2PdfEngagementDetails | undefined,
  labels: SmartFormV2PdfLabels,
  locale: string,
  valid: boolean
) {
  const clientName = details?.clientName?.trim() || labels.notProvided;
  const engagementCode = details?.engagementCode?.trim() || labels.notProvided;
  const financialStatementDate = details?.financialStatementDate
    ? formatPdfDate(toDate(details.financialStatementDate), locale, true)
    : labels.notProvided;
  const status = valid ? labels.complete : labels.incomplete;

  const cells = [
    [labels.clientName, clientName],
    [labels.engagementCode, engagementCode],
    [labels.financialStatementDate, financialStatementDate],
    [labels.status, status],
  ]
    .map(
      ([label, value]) =>
        `[#stack(spacing: 0.7mm, text(font: sans-fonts, size: 7.2pt, weight: "medium", fill: faint, ${typstString(assertPresentValue(label))}), text(font: serif-fonts, size: 8.4pt, weight: "medium", fill: ink, ${typstString(assertPresentValue(value))}))]`
    )
    .join(",\n");

  return `#block(width: 100%, stroke: (top: 0.45pt + rule, bottom: 0.45pt + rule), inset: (top: 2mm, bottom: 2mm))[
  #grid(columns: (1.45fr, 1fr, 1fr, 0.7fr), column-gutter: 3mm, ${cells})
]`;
}

function renderSignoffs(
  signoffs: readonly SmartFormV2PdfSignoff[],
  labels: SmartFormV2PdfLabels,
  locale: string
) {
  const preparers = signoffs.filter((signoff) => signoff.type === "PREPARER");
  const approvers = signoffs.filter((signoff) => signoff.type === "REVIEWER");
  const renderPeople = (people: readonly SmartFormV2PdfSignoff[]) => {
    if (people.length === 0) {
      return `#grid(columns: (1fr, auto), [#text(weight: "regular", "—")], [#text(font: sans-fonts, size: 7.5pt, fill: faint, ${typstString(labels.pendingSignoff)})])`;
    }
    return people
      .map(
        (person) =>
          `#grid(columns: (1fr, auto), column-gutter: 2mm, [#text(weight: "regular", ${typstString(person.userName)})], [#text(font: sans-fonts, size: 7.5pt, fill: faint, ${typstString(formatPdfDate(toDate(person.signedAt), locale, false))})])`
      )
      .join("\n#v(0.8mm)\n");
  };
  const group = (label: string, people: readonly SmartFormV2PdfSignoff[]) => `[
    #text(font: sans-fonts, size: 7.5pt, weight: "regular", fill: faint, ${typstString(label)})
    #v(0.8mm)
    #line(length: 100%, stroke: 0.3pt + light-rule)
    #v(1.1mm)
    ${renderPeople(people)}
  ]`;
  return `#block(width: 100%, inset: (top: 1mm, bottom: 4mm))[
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 12mm,
    ${group(labels.preparerSignoff, preparers)},
    ${group(labels.approverSignoff, approvers)},
  )
]`;
}

function localizedText(
  value: { values: Record<string, SmartFormV2RichTextDocument> } | undefined,
  locale: string
) {
  const document =
    value?.values[locale] ??
    (value ? Object.values(value.values)[0] : undefined);
  return document ? richTextPlainText(document) : "";
}

function richTextPlainText(document: SmartFormV2RichTextDocument): string {
  return document.content.map(richTextBlockPlainText).join(" ").trim();
}

function richTextBlockPlainText(block: SmartFormV2RichTextBlock): string {
  if (block.type === "paragraph" || block.type === "heading") {
    return block.content
      .filter((inline) => inline.type === "text")
      .map((inline) => inline.text)
      .join("");
  }
  if (block.type === "embed") {
    return block.labelSnapshot ?? block.entityId;
  }
  if (block.type === "bulletList" || block.type === "orderedList") {
    return block.items
      .map((item) => item.content.map(richTextBlockPlainText).join(" "))
      .join(" ");
  }
  if (block.type === "blockquote") {
    return block.content.map(richTextBlockPlainText).join(" ");
  }
  if (block.type === "table") {
    return block.rows
      .map((row) =>
        row.cells
          .map((cell) => cell.content.map(richTextBlockPlainText).join(" "))
          .join(" ")
      )
      .join(" ");
  }
  return "";
}

function renderMultilineText(value: string, labels: SmartFormV2PdfLabels) {
  if (!value.trim()) {
    return typstText(labels.notProvided);
  }
  return value
    .split(/\r?\n/)
    .map(
      (line, index) =>
        `${index ? "#linebreak()\n" : ""}${typstText(line || " ")}`
    )
    .join("\n");
}

function formatPdfDate(value: Date, locale: string, longEnglish: boolean) {
  if (locale.toLowerCase().startsWith("en") && longEnglish) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(value);
  }
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function typstString(value: string) {
  return JSON.stringify(value);
}

function typstText(value: string) {
  return `#text(${typstString(value)})`;
}

function renderDocumentReviewAnchor(title: string) {
  // A zero-flow placement measures the centered title without changing its
  // paragraph spacing (and therefore without shifting any row anchors).
  return `#place(left)[#layout(size => context {
    let title = text(font: sans-fonts, size: 18pt, weight: "regular", fill: ink, ${typstString(title)})
    let natural = measure(title)
    let fitted = measure(title, width: size.width)
    let p = here().position()
    metadata((smartform_review_anchor: true, document_title: true, node_id: "", position: (page: p.page, x: (p.x + (size.width + calc.min(natural.width, size.width)) / 2) / 1pt, y: (p.y + fitted.height / 2) / 1pt)))
  })]`;
}

function renderReviewAnchor(
  reviewTargets: ReadonlySet<string>,
  nodeId: string,
  rowId?: string
) {
  if (!reviewTargets.has(reviewTargetKey(nodeId, rowId))) {
    return "";
  }
  // Query serializes Typst lengths as strings such as "326.4pt". Export
  // explicit point numbers so the PDF coordinate reader does not drop anchors.
  // Row markers are relative to their cell; other markers follow document flow.
  return `#place(${rowId ? "top + left" : "left"})[#context { let p = here().position(); metadata((smartform_review_anchor: true, node_id: ${typstString(nodeId)}, row_id: ${rowId ? typstString(rowId) : "none"}, position: (page: p.page, x: p.x / 1pt, y: p.y / 1pt))) }]`;
}

function compileTypstPdf(source: string) {
  try {
    const compiler = NodeCompiler.create();
    const compiled = compiler.compile({ mainFileContent: source });
    if (compiled.hasError()) {
      const diagnostic = compiled.takeError() ?? compiled.takeDiagnostics();
      throw new Error(extractTypstError(diagnostic));
    }
    if (!compiled.result) {
      throw new Error("Typst compilation returned no document");
    }
    const metadata = compiler.query(compiled.result, {
      selector: "metadata",
    }) as unknown;
    return {
      pdf: Buffer.from(compiler.pdf(compiled.result)),
      anchors: collectSmartFormV2PdfAnchors(metadata),
    };
  } catch (error) {
    throw new ServiceUnavailableException({
      code: "BAD_REQUEST",
      message: `SmartForm V2 PDF export failed: ${extractTypstError(error)}`,
    });
  }
}

function collectSmartFormV2PdfAnchors(
  metadata: unknown
): SmartFormV2PdfAnchor[] {
  if (!Array.isArray(metadata)) {
    return [];
  }
  const anchors: SmartFormV2PdfAnchor[] = [];
  for (const item of metadata) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const { value } = item as { value?: unknown };
    if (!value || typeof value !== "object") {
      continue;
    }
    const candidate = value as {
      smartform_review_anchor?: unknown;
      document_title?: unknown;
      node_id?: unknown;
      row_id?: unknown;
      position?: { page?: unknown; x?: unknown; y?: unknown };
    };
    if (candidate.smartform_review_anchor !== true) {
      continue;
    }
    if (typeof candidate.node_id !== "string") {
      continue;
    }
    const page = numericTypstValue(candidate.position?.page);
    const x = numericTypstValue(candidate.position?.x);
    const y = numericTypstValue(candidate.position?.y);
    if (page === null || x === null || y === null) {
      continue;
    }
    anchors.push({
      ...(candidate.document_title === true ? { documentTitle: true } : {}),
      nodeId: candidate.node_id,
      ...(typeof candidate.row_id === "string"
        ? { rowId: candidate.row_id }
        : {}),
      pageIndex: Math.max(0, Math.trunc(page) - 1),
      x,
      y,
    });
  }
  return anchors;
}

function numericTypstValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewTargetKey(nodeId: string, rowId?: string) {
  return `${nodeId}\0${rowId ?? ""}`;
}

function collectReviewTargetLabels(
  definition: SmartFormV2CompiledDefinition,
  locale: string
) {
  const labels = new Map<string, string>();
  const visit = (nodes: SmartFormV2CompiledDefinition["children"]) => {
    for (const node of nodes) {
      if ("title" in node && node.title) {
        labels.set(reviewTargetKey(node.id), localizedText(node.title, locale));
      }
      if (node.kind === "sheet" && node.rows.mode === "fixed") {
        for (const { row, number } of flattenRowsWithNumbers(
          node.rows.items,
          node.rows.numbering
        )) {
          labels.set(
            reviewTargetKey(node.id, row.id),
            formatRowLabel(row, locale, number)
          );
        }
      }
      if (node.kind === "section" || node.kind === "group") {
        visit(node.children);
      }
      if (node.kind === "conditional") {
        for (const branch of node.branches) {
          visit(branch.children);
        }
        visit(node.otherwise.children);
      }
    }
  };
  visit(definition.children);
  return labels;
}

function reviewStatusLabel(status: string, zh: boolean) {
  const labels: Record<string, string> = zh
    ? { OPEN: "待回复", REPLIED: "已回复", CLEARED: "已解决" }
    : { OPEN: "Awaiting reply", REPLIED: "Replied", CLEARED: "Resolved" };
  return labels[status] ?? status;
}

function formatReviewQuestionGroup(
  questions: SmartFormV2PdfReviewQuestion[],
  locale: string
) {
  const zh = locale.toLowerCase().startsWith("zh");
  const count = questions.length;
  const title = zh
    ? `复核注释 · ${count} 个问题`
    : `Review notes · ${count} ${count === 1 ? "question" : "questions"}`;
  const summary = ["OPEN", "REPLIED", "CLEARED"]
    .flatMap((status) => {
      const total = questions.filter(
        (question) => question.status === status
      ).length;
      return total ? [`${reviewStatusLabel(status, zh)} ${total}`] : [];
    })
    .join(" · ");
  const sections = questions.map(
    (question, index) =>
      `Q${index + 1} · ${reviewStatusLabel(question.status, zh)}\n${formatReviewQuestionAnnotation(question, locale).content}`
  );
  return {
    title,
    review: {
      version: 1,
      target: questions[0]?.smartFormTargetLabel?.trim(),
      questions: questions.map((question) => ({
        id: question.id,
        status: reviewStatusLabel(question.status, zh),
        assignedTo: question.assignedTo
          ? userDisplayName(question.assignedTo, zh)
          : undefined,
        messages: formatReviewQuestionAnnotation(question, locale).messages,
      })),
    } satisfies PdfReviewNote,
    content: [questions[0]?.smartFormTargetLabel?.trim(), summary, ...sections]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function formatReviewQuestionAnnotation(
  question: SmartFormV2PdfReviewQuestion,
  locale: string
) {
  const zh = locale.toLowerCase().startsWith("zh");
  const messageLabels: Record<string, string> = zh
    ? {
        QUESTION: "问题",
        REPLY: "回复",
        FOLLOW_UP: "追问",
        REOPEN: "重新打开",
      }
    : {
        QUESTION: "Question",
        REPLY: "Reply",
        FOLLOW_UP: "Follow-up",
        REOPEN: "Reopened",
      };
  const status = reviewStatusLabel(question.status, zh);
  const target = question.smartFormTargetLabel?.trim();
  const title = [zh ? "复核问题" : "Review question", target, status]
    .filter(Boolean)
    .join(" - ");
  const messages: NonNullable<SmartFormV2PdfReviewQuestion["messages"]> =
    question.messages?.length
      ? [...question.messages]
      : [
          {
            id: `${question.id}-question`,
            messageType: "QUESTION",
            body: question.body,
            createdAt: question.createdAt,
            author: question.createdBy,
          },
        ];
  if (
    question.replyBody?.trim() &&
    !messages.some((message) => message.messageType === "REPLY")
  ) {
    messages.push({
      id: `${question.id}-legacy-reply`,
      messageType: "REPLY",
      body: question.replyBody,
      createdAt: question.repliedAt ?? question.updatedAt ?? question.createdAt,
      author: question.repliedBy,
    });
  }
  if (!messages.some((message) => message.messageType === "QUESTION")) {
    messages.unshift({
      id: `${question.id}-question`,
      messageType: "QUESTION",
      body: question.body,
      createdAt: question.createdAt,
      author: question.createdBy,
    });
  }
  messages.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a.id.localeCompare(b.id)
  );
  const lines: string[] = [];
  messages.forEach((message) => {
    lines.push(
      userDisplayName(message.author, zh),
      formatPdfAnnotationDate(message.createdAt, locale),
      "",
      message.body.trim()
    );
    const files = message.images
      ?.map((image) => image.originalName ?? image.fileName)
      .filter(Boolean);
    if (files?.length) {
      lines.push(`${zh ? "附件" : "Attachments"}: ${files.join(", ")}`);
    }
    const references = message.references
      ?.map((reference) =>
        [reference.workingPaper?.code, reference.workingPaper?.title]
          .filter(Boolean)
          .join(" ")
      )
      .filter(Boolean);
    if (references?.length) {
      lines.push(`${zh ? "引用底稿" : "References"}: ${references.join(", ")}`);
    }
    lines.push("");
  });
  lines.push(`${zh ? "状态" : "Status"}: ${status}`);
  if (question.assignedTo) {
    lines.push(
      `${zh ? "负责人" : "Assigned to"}: ${userDisplayName(question.assignedTo, zh)}`
    );
  }
  return {
    title,
    content: lines.join("\n").trim(),
    messages: messages.map((message) => ({
      id: message.id,
      kind: messageLabels[message.messageType] ?? message.messageType,
      author: userDisplayName(message.author, zh),
      date: formatPdfAnnotationDate(message.createdAt, locale),
      body: message.body,
      images: (message.images ?? []).map((image) => ({
        id: image.id,
        label: image.originalName ?? image.fileName,
      })),
      references: (message.references ?? []).map((reference) => ({
        id: reference.workingPaper?.id,
        label: [reference.workingPaper?.code, reference.workingPaper?.title]
          .filter(Boolean)
          .join(" "),
      })),
    })),
  };
}

function userDisplayName(
  user: { name?: string | null; email?: string | null } | null | undefined,
  zh: boolean
) {
  return (
    user?.name?.trim() ||
    user?.email?.trim() ||
    (zh ? "未知用户" : "Unknown user")
  );
}

function formatPdfAnnotationDate(value: Date | string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function toPdfAnnotationDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const digits = [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
    date.getUTCHours().toString().padStart(2, "0"),
    date.getUTCMinutes().toString().padStart(2, "0"),
    date.getUTCSeconds().toString().padStart(2, "0"),
  ].join("");
  return `D:${digits}Z`;
}

function reviewQuestionColor(status: string) {
  const color =
    status === "CLEARED"
      ? [0.2, 0.72, 0.42]
      : status === "REPLIED"
        ? [0.25, 0.55, 0.95]
        : [1, 0.72, 0.1];
  return color.map((component) => PDFNumber.of(component));
}

function extractTypstError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "shortDiagnostics" in error) {
    return JSON.stringify(error.shortDiagnostics);
  }
  return "unknown Typst error";
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
