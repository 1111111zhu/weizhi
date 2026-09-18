"use client";

import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CoreNode,
  SmartFormV2FieldAnswer,
  SmartFormV2FieldDefinition,
  SmartFormV2FieldValue,
  SmartFormV2FixedSheetRow,
  SmartFormV2I18nConfig,
  SmartFormV2LocalizedRichText,
  SmartFormV2NumberingRule,
  SmartFormV2Response,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  SmartFormV2RichTextInline,
  SmartFormV2SheetColumnNode,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  isSmartFormV2ExpressionTrue,
  resolveSmartFormV2ConditionalBranch,
} from "@project-wing/shared";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, ExpandedState } from "@tanstack/react-table";
import {
  CalendarDays,
  Check,
  ChevronsDown,
  ChevronsUp,
  FileText,
  Link2,
  Minus,
  Paperclip,
  Plus,
} from "lucide-react";
import {
  Fragment,
  createElement,
  createContext,
  useContext,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/extend/ui/badge";
import { Button } from "@/components/extend/ui/button";
import { Card } from "@/components/extend/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/extend/ui/tooltip";
import {
  SmartFormV2ExpansionProvider,
  useSmartFormV2ExpansionCommand,
  useSmartFormV2MobileLayout,
  useSmartFormV2Viewport,
} from "@/components/smart-form-v2-expansion";
import {
  SmartFormV2ReviewQuestionButton,
  SmartFormV2ReviewQuestionsProvider,
  SmartFormV2ReviewTargetProvider,
  smartFormV2LocalizedPlainText,
  smartFormV2NodeContainsReviewTarget,
  useSmartFormV2ReviewTarget,
  useSmartFormV2ReviewTargetFocus,
} from "@/components/smart-form-v2-review-questions";
import type {
  SmartFormV2ReviewQuestionsConfig,
  SmartFormV2ReviewTarget,
} from "@/components/smart-form-v2-review-questions";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { SmartFormV2MobileHeader } from "./smart-form-v2-mobile-header";
import type { SmartFormV2MobileHeaderConfig } from "./smart-form-v2-mobile-header";
import { SmartFormV2MobileRecords } from "./smart-form-v2-mobile-records";
import { mobileSheetLayout } from "./smart-form-v2-mobile-sheet";
import {
  isSmartFormV2FieldRequired,
  SmartFormV2RequiredIndicator,
} from "./smart-form-v2-required-indicator";

import mobileFormStyles from "./smart-form-v2-mobile-form.module.css";
import mobileRecordStyles from "./smart-form-v2-mobile-records.module.css";
import tableStyles from "@/components/smart-form-v2-table.module.css";

const EMPTY_FIXED_SHEET_ROWS: SmartFormV2FixedSheetRow[] = [];

export type SmartFormV2ReadonlyCopy = {
  readOnly: string;
  schemaVersion: string;
  emptyValue: string;
  unresolvedComponent: string;
  attachment: string;
  reference: string;
  tableLabel: string;
  expand: string;
  collapse: string;
  expandSection: string;
  collapseSection: string;
  expansionControls: string;
  expandAll: string;
  collapseAll: string;
  conditionPending: string;
  conditionMatched: string;
  conditionOtherwise: string;
  required: string;
  optional: string;
};

type SmartFormV2ReadonlyProps = {
  definition: SmartFormV2CompiledDefinition;
  locale: string;
  copy: SmartFormV2ReadonlyCopy;
  response?: SmartFormV2Response;
  reviewQuestions?: SmartFormV2ReviewQuestionsConfig;
  focusTarget?: SmartFormV2ReviewTarget | null;
  className?: string;
  mobileHeader?: SmartFormV2MobileHeaderConfig;
};

type SheetRowModel = {
  source: SmartFormV2FixedSheetRow;
  number: string;
  depth: number;
  children?: SheetRowModel[];
};

export const SmartFormV2Readonly = memo(
  ({
    definition,
    locale,
    copy,
    response,
    reviewQuestions,
    focusTarget,
    className,
    mobileHeader,
  }: SmartFormV2ReadonlyProps) => {
    const isMobile = useSmartFormV2MobileLayout();
    const [expansionCommand, setExpansionCommand] = useState({
      expanded: true,
      version: 0,
    });
    const documentRef = useRef<HTMLDivElement>(null);
    const setAllExpanded = useCallback((expanded: boolean) => {
      setExpansionCommand((current) => ({
        expanded,
        version: current.version + 1,
      }));
    }, []);

    useSmartFormV2ReviewTargetFocus({
      rootRef: documentRef,
      target: focusTarget,
      expandAll: useCallback(() => setAllExpanded(true), [setAllExpanded]),
    });

    return (
      <SmartFormV2ExpansionProvider value={expansionCommand}>
        <SmartFormV2ReviewTargetProvider value={focusTarget ?? null}>
          <SmartFormV2ReviewQuestionsProvider value={reviewQuestions ?? null}>
            <div ref={documentRef} className="contents">
              <Card
                render={<article />}
                className={cn(
                  "smart-form-v2-document mx-auto w-full max-w-[1440px] overflow-hidden rounded-xl border-border/70 bg-card text-card-foreground shadow-xs/5",
                  mobileFormStyles.document,
                  className
                )}
              >
                {isMobile ? (
                  <SmartFormV2MobileHeader
                    title={
                      <LocalizedRichText
                        as="h1"
                        value={definition.title}
                        locale={locale}
                        i18n={definition.i18n}
                      />
                    }
                    config={mobileHeader}
                    description={
                      definition.description ? (
                        <LocalizedRichText
                          value={definition.description}
                          locale={locale}
                          i18n={definition.i18n}
                        />
                      ) : null
                    }
                  />
                ) : (
                  <header className="border-b border-border/70 bg-card px-5 py-5 md:px-8 md:py-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div
                        data-smart-form-document-title
                        className="max-w-4xl min-w-0"
                      >
                        <LocalizedRichText
                          as="h1"
                          value={definition.title}
                          locale={locale}
                          i18n={definition.i18n}
                          className="text-2xl font-semibold tracking-tight md:text-[1.75rem]"
                        />
                        {definition.description ? (
                          <LocalizedRichText
                            value={definition.description}
                            locale={locale}
                            i18n={definition.i18n}
                            className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {isMobile ? null : (
                          <ButtonGroup label={copy.expansionControls}>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => setAllExpanded(true)}
                            >
                              <ChevronsDown className="size-3.5" />
                              {copy.expandAll}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => setAllExpanded(false)}
                            >
                              <ChevronsUp className="size-3.5" />
                              {copy.collapseAll}
                            </Button>
                          </ButtonGroup>
                        )}
                        <Badge
                          data-smart-form-document-badge
                          variant="outline"
                          size="lg"
                          className={cn(
                            tableStyles.headerBorder,
                            tableStyles.headerForeground,
                            tableStyles.headerSurface
                          )}
                        >
                          <FileText className="size-3.5" />
                          {copy.readOnly}
                        </Badge>
                        <Badge
                          data-smart-form-document-badge
                          variant="secondary"
                          size="lg"
                          className="font-normal"
                        >
                          {copy.schemaVersion} 2
                        </Badge>
                      </div>
                    </div>
                  </header>
                )}

                <div className="divide-y divide-border/60 bg-card">
                  {definition.children.map((node) => (
                    <NodeRenderer
                      key={node.id}
                      node={node}
                      definition={definition}
                      depth={0}
                      locale={locale}
                      i18n={definition.i18n}
                      copy={copy}
                      response={response}
                    />
                  ))}
                </div>
              </Card>
            </div>
          </SmartFormV2ReviewQuestionsProvider>
        </SmartFormV2ReviewTargetProvider>
      </SmartFormV2ExpansionProvider>
    );
  }
);
SmartFormV2Readonly.displayName = "SmartFormV2Readonly";

function NodeRenderer({
  node,
  definition,
  depth,
  locale,
  i18n,
  copy,
  response,
}: {
  node: SmartFormV2CoreNode;
  definition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  response?: SmartFormV2Response;
}) {
  const reviewTarget = useSmartFormV2ReviewTarget();
  if (
    response &&
    !smartFormV2NodeContainsReviewTarget(node, reviewTarget) &&
    !isSmartFormV2ExpressionTrue(definition, response, node.visibleWhen)
  ) {
    return null;
  }
  switch (node.kind) {
    case "section": {
      return (
        <SectionRenderer
          node={node}
          definition={definition}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
          response={response}
        />
      );
    }
    case "group": {
      return (
        <section
          className="space-y-3"
          data-smart-form-node-id={node.id}
          data-smart-form-node-kind={node.kind}
        >
          {node.title || node.description ? (
            <header>
              {node.title ? (
                <LocalizedRichText
                  as="h3"
                  value={node.title}
                  locale={locale}
                  i18n={i18n}
                  className="text-lg font-semibold tracking-tight"
                />
              ) : null}
              {node.description ? (
                <LocalizedRichText
                  value={node.description}
                  locale={locale}
                  i18n={i18n}
                  className="mt-1 text-sm text-muted-foreground"
                />
              ) : null}
            </header>
          ) : null}
          {node.children.map((child) => (
            <NodeRenderer
              key={child.id}
              node={child}
              definition={definition}
              depth={depth + 1}
              locale={locale}
              i18n={i18n}
              copy={copy}
              response={response}
            />
          ))}
        </section>
      );
    }
    case "conditional": {
      return (
        <ConditionalRenderer
          node={node}
          definition={definition}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
          response={response}
        />
      );
    }
    case "content": {
      return (
        <section
          className={staticContentGutterClassName(depth)}
          data-smart-form-node-id={node.id}
          data-smart-form-node-kind={node.kind}
        >
          <div
            className={cn(
              "w-full border-s-2 py-3.5 pe-4 ps-8",
              tableStyles.groupAccentStart,
              tableStyles.groupSurfaceMuted
            )}
          >
            <LocalizedRichText
              value={node.content}
              locale={locale}
              i18n={i18n}
              className="space-y-2 text-sm leading-6 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:my-0 [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:my-0 [&_ul]:space-y-1.5 [&_ul]:pl-5"
            />
          </div>
        </section>
      );
    }
    case "field": {
      return (
        <ReadOnlyField
          id={node.id}
          depth={depth}
          label={node.label}
          help={node.help}
          definition={node.value}
          answer={response?.fields[node.id]}
          locale={locale}
          i18n={i18n}
          copy={copy}
          required={
            node.required ||
            (response && node.requiredWhen !== undefined
              ? isSmartFormV2ExpressionTrue(
                  definition,
                  response,
                  node.requiredWhen
                )
              : false)
          }
        />
      );
    }
    case "sheet": {
      return (
        <SheetRenderer
          sheet={node}
          definition={definition}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
          response={response}
        />
      );
    }
    default: {
      return (
        <p className="text-sm text-destructive">{copy.unresolvedComponent}</p>
      );
    }
  }
}

function ConditionalRenderer({
  node,
  definition,
  depth,
  locale,
  i18n,
  copy,
  response,
}: {
  node: Extract<SmartFormV2CoreNode, { kind: "conditional" }>;
  definition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  response?: SmartFormV2Response;
}) {
  const branch = response
    ? resolveSmartFormV2ConditionalBranch(definition, response, node)
    : ({ type: "pending" } as const);
  const activeArm =
    branch.type === "branch"
      ? node.branches.find((candidate) => candidate.id === branch.branchId)
      : branch.type === "otherwise"
        ? node.otherwise
        : undefined;
  const activeChildren = activeArm?.children ?? [];

  return (
    <section
      data-smart-form-conditional-branch={
        branch.type === "pending" ? "pending" : branch.branchId
      }
      data-smart-form-node-id={node.id}
      data-smart-form-node-kind={node.kind}
    >
      <ReadOnlyField
        id={node.branchQuestion.id}
        depth={depth}
        label={node.branchQuestion.label}
        help={node.branchQuestion.help}
        definition={node.branchQuestion.value}
        answer={response?.fields[node.branchQuestion.id]}
        locale={locale}
        i18n={i18n}
        copy={copy}
        required={node.branchQuestion.required}
      />
      {activeChildren.length > 0 ? (
        <div className="mt-4 grid w-full gap-4 md:ms-6 md:mt-5 md:w-[calc(100%-1.5rem)] md:gap-5">
          {activeChildren.map((child) => (
            <NodeRenderer
              key={child.id}
              node={child}
              definition={definition}
              depth={depth}
              locale={locale}
              i18n={i18n}
              copy={copy}
              response={response}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SectionRenderer({
  node,
  definition,
  depth,
  locale,
  i18n,
  copy,
  response,
}: {
  node: Extract<SmartFormV2CoreNode, { kind: "section" }>;
  definition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  response?: SmartFormV2Response;
}) {
  const isMobile = useSmartFormV2MobileLayout();
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const isExpanded = isMobile || desktopExpanded;
  const expansionCommand = useSmartFormV2ExpansionCommand();

  useEffect(() => {
    setDesktopExpanded(expansionCommand.expanded);
  }, [expansionCommand]);

  return (
    <section
      className={smartFormSectionClassName(depth)}
      data-smart-form-node-id={node.id}
      data-smart-form-node-kind={node.kind}
    >
      <header
        className={cn(
          "max-w-5xl",
          isExpanded && "mb-5 border-b border-border/70 pb-3.5"
        )}
      >
        <div className="flex items-start gap-2.5">
          {isMobile ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className={cn(
                "mt-0.5 size-6 shrink-0 rounded-md border-border bg-background shadow-none",
                tableStyles.headerInteractive
              )}
              aria-label={
                isExpanded ? copy.collapseSection : copy.expandSection
              }
              aria-expanded={isExpanded}
              onClick={() => setDesktopExpanded((current) => !current)}
            >
              {isExpanded ? (
                <Minus className="size-3.5 opacity-100" />
              ) : (
                <Plus className="size-3.5 opacity-100" />
              )}
            </Button>
          )}
          <LocalizedRichText
            as="h2"
            value={node.title}
            locale={locale}
            i18n={i18n}
            className={cn(
              "font-semibold tracking-tight",
              depth === 0 ? "text-xl md:text-[1.375rem]" : "text-lg"
            )}
          />
        </div>
        {isExpanded && node.description ? (
          <LocalizedRichText
            value={node.description}
            locale={locale}
            i18n={i18n}
            className="mt-1.5 text-sm leading-6 text-muted-foreground md:ps-9"
          />
        ) : null}
      </header>
      {isExpanded ? (
        <div className="space-y-5">
          {node.children.map((child) => (
            <NodeRenderer
              key={child.id}
              node={child}
              definition={definition}
              depth={depth + 1}
              locale={locale}
              i18n={i18n}
              copy={copy}
              response={response}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReadOnlyField({
  id,
  depth,
  label,
  help,
  definition,
  answer,
  locale,
  i18n,
  copy,
  required,
}: {
  id: string;
  depth: number;
  label: SmartFormV2LocalizedRichText;
  help?: SmartFormV2LocalizedRichText;
  definition: SmartFormV2FieldDefinition;
  answer?: SmartFormV2FieldAnswer;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  required?: boolean;
}) {
  return (
    <div
      className={cn("grid gap-2", nodeContentInsetClassName(depth))}
      data-smart-form-node-id={id}
      data-smart-form-node-kind="field"
    >
      <div className="flex items-start gap-1">
        <LocalizedRichText
          value={label}
          locale={locale}
          i18n={i18n}
          className="text-sm font-medium"
        />
        <SmartFormV2RequiredIndicator
          required={Boolean(required)}
          requiredLabel={copy.required}
          optionalLabel={copy.optional}
        />
        <SmartFormV2ReviewQuestionButton
          target={{
            nodeId: id,
            label: smartFormV2LocalizedPlainText(label, locale, i18n),
          }}
        />
      </div>
      {help ? (
        <LocalizedRichText
          value={help}
          locale={locale}
          i18n={i18n}
          className={cn(
            "text-sm leading-6 text-muted-foreground",
            mobileFormStyles.fieldDescription
          )}
        />
      ) : null}
      <div
        className={cn(
          "min-h-8 rounded-lg border border-input bg-muted/35 px-3 py-2 shadow-xs/5",
          mobileFormStyles.staticValue
        )}
      >
        <FieldValue
          definition={definition}
          answer={answer}
          locale={locale}
          i18n={i18n}
          copy={copy}
        />
      </div>
    </div>
  );
}

function SheetRenderer({
  sheet,
  definition,
  depth,
  locale,
  i18n,
  copy,
  response,
}: {
  sheet: SmartFormV2SheetNode;
  definition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  response?: SmartFormV2Response;
}) {
  const viewport = useSmartFormV2Viewport();
  const isMobile = viewport === true;
  const expansionCommand = useSmartFormV2ExpansionCommand();
  const [expanded, setExpanded] = useState<ExpandedState>(
    expansionCommand.expanded ? true : {}
  );

  useEffect(() => {
    setExpanded(expansionCommand.expanded ? true : {});
  }, [expansionCommand]);

  const fixedRows = sheet.rows;
  const recordLayout = mobileSheetLayout(sheet) === "records";
  const showMobileRecords = viewport !== false && recordLayout;
  const showTable = viewport !== true || !recordLayout;
  const fixedItems =
    fixedRows.mode === "fixed" ? fixedRows.items : EMPTY_FIXED_SHEET_ROWS;
  const fixedNumbering =
    fixedRows.mode === "fixed" ? fixedRows.numbering : undefined;

  // TanStack Table treats a new data reference as a data change. Keeping these
  // Derived inputs stable prevents its auto-reset logic from scheduling another
  // Render indefinitely while the designer is displaying a live preview.
  const answerRows = useMemo(
    () =>
      new Map(
        (response?.sheets[sheet.id]?.rows ?? []).map((row) => [
          row.sourceRowId ?? row.id,
          row,
        ])
      ),
    [response, sheet.id]
  );
  const rows = useMemo(
    () => buildSheetRows(fixedItems, fixedNumbering),
    [fixedItems, fixedNumbering]
  );
  const columns = useMemo<ColumnDef<SheetRowModel>[]>(
    () =>
      sheet.columns.map((column) =>
        createSheetColumn({
          sheetId: sheet.id,
          column,
          definition,
          locale,
          i18n,
          copy,
          answerRows,
          response,
        })
      ),
    [
      answerRows,
      copy,
      definition,
      i18n,
      locale,
      response,
      sheet.columns,
      sheet.id,
    ]
  );
  const table = useReactTable({
    data: rows,
    columns,
    getSubRows: (row) => row.children,
    getRowId: (row) => row.source.id,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    state: { expanded: isMobile ? true : expanded },
  });

  if (fixedRows.mode !== "fixed") {
    return (
      <p
        className={cn(
          "text-sm text-muted-foreground",
          nodeContentInsetClassName(depth)
        )}
      >
        {copy.emptyValue}
      </p>
    );
  }

  return (
    <div
      className={nodeContentInsetClassName(depth)}
      data-smart-form-node-id={sheet.id}
      data-smart-form-node-kind={sheet.kind}
    >
      {sheet.title || sheet.description ? (
        <header className="mb-3">
          {sheet.title ? (
            <LocalizedRichText
              as={depth === 0 ? "h2" : "h3"}
              value={sheet.title}
              locale={locale}
              i18n={i18n}
              className={cn(
                "font-semibold tracking-tight",
                depth === 0 ? "text-xl md:text-[1.375rem]" : "text-lg"
              )}
            />
          ) : null}
          {sheet.description ? (
            <LocalizedRichText
              value={sheet.description}
              locale={locale}
              i18n={i18n}
              className="mt-1 text-sm text-muted-foreground"
            />
          ) : null}
        </header>
      ) : null}

      {showTable ? (
        <div
          data-smart-form-sheet-table
          className={cn(
            "hidden min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background shadow-none md:block",
            mobileSheetLayout(sheet) === "table" &&
              mobileRecordStyles.scrollTable
          )}
        >
          <Table
            label={`${copy.tableLabel}: ${sheet.id}`}
            className="w-full min-w-0 table-fixed"
          >
            <TableHeader className={tableStyles.headerSurface}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className={cn(
                    "hover:bg-transparent hover:shadow-none",
                    tableStyles.headerBorder
                  )}
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "h-11 min-w-0 max-w-0 whitespace-normal px-3 text-sm font-semibold leading-5",
                        tableStyles.headerForeground,
                        sheetColumnClassName(header.column.id)
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                if (row.original.source.role === "group") {
                  return (
                    <TableRow
                      key={row.id}
                      data-smart-form-node-id={sheet.id}
                      data-smart-form-row-id={row.original.source.id}
                      className={cn(
                        "border-border/60 hover:shadow-none",
                        tableStyles.groupInteractive
                      )}
                    >
                      <TableCell
                        colSpan={row.getVisibleCells().length}
                        className={cn(
                          "border-l-2 whitespace-normal px-3 py-3 align-top text-sm font-semibold leading-5",
                          tableStyles.groupAccentLeft
                        )}
                      >
                        <ProcedureLabel
                          sheetId={sheet.id}
                          row={row.original}
                          locale={locale}
                          i18n={i18n}
                          copy={copy}
                          canExpand={row.getCanExpand()}
                          isExpanded={row.getIsExpanded()}
                          onToggleExpanded={() => row.toggleExpanded()}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow
                    key={row.id}
                    data-smart-form-node-id={sheet.id}
                    data-smart-form-row-id={row.original.source.id}
                    className={cn(
                      "border-border/60 bg-background transition-colors hover:shadow-none",
                      tableStyles.groupRow
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "h-14 min-w-0 max-w-0 whitespace-normal px-3 py-2.5 align-top text-sm leading-5",
                          sheetColumnClassName(cell.column.id)
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {showMobileRecords ? (
        <SmartFormV2MobileRecords
          sheet={sheet}
          rows={table.getRowModel().rows.map((row) => row.original)}
          definition={definition}
          response={response}
          requiredLabel={copy.required}
          optionalLabel={copy.optional}
          renderText={(value) => (
            <LocalizedRichText value={value} locale={locale} i18n={i18n} />
          )}
          isVisible={(row, column) =>
            isReadonlySheetCellVisible(row, column, definition, response)
          }
          renderHeading={(row) => {
            const tableRow = table.getRow(row.source.id);
            return (
              <ProcedureLabel
                sheetId={sheet.id}
                row={row}
                locale={locale}
                i18n={i18n}
                copy={copy}
                canExpand={tableRow.getCanExpand()}
                isExpanded={tableRow.getIsExpanded()}
                onToggleExpanded={() => tableRow.toggleExpanded()}
              />
            );
          }}
          renderValue={(row, column) => (
            <SheetValueCell
              column={column}
              row={row}
              definition={definition}
              response={response}
              answer={answerRows.get(row.source.id)?.cells[column.id]}
              locale={locale}
              i18n={i18n}
              copy={copy}
            />
          )}
        />
      ) : null}
    </div>
  );
}

function createSheetColumn({
  sheetId,
  column,
  definition,
  locale,
  i18n,
  copy,
  answerRows,
  response,
}: {
  sheetId: string;
  column: SmartFormV2SheetColumnNode;
  definition: SmartFormV2CompiledDefinition;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  response?: SmartFormV2Response;
  answerRows: Map<
    string,
    {
      cells: Record<string, SmartFormV2FieldAnswer>;
    }
  >;
}): ColumnDef<SheetRowModel> {
  if (column.kind === "columnGroup") {
    return {
      id: column.id,
      header: () => (
        <LocalizedRichText value={column.header} locale={locale} i18n={i18n} />
      ),
      columns: column.children.map((child) =>
        createSheetColumn({
          sheetId,
          column: child,
          definition,
          locale,
          i18n,
          copy,
          answerRows,
          response,
        })
      ),
    };
  }

  return {
    id: column.id,
    accessorFn: (row) => row.source.id,
    header: () => (
      <span className="inline-flex items-start gap-1">
        <LocalizedRichText value={column.header} locale={locale} i18n={i18n} />
        {column.cell.kind === "field" ? (
          <SmartFormV2RequiredIndicator
            required={isSmartFormV2FieldRequired(
              column.cell.field,
              definition,
              response
            )}
            requiredLabel={copy.required}
            optionalLabel={copy.optional}
          />
        ) : null}
      </span>
    ),
    cell: ({ row }) =>
      column.cell.kind === "rowLabel" ? (
        <ProcedureLabel
          sheetId={sheetId}
          row={row.original}
          locale={locale}
          i18n={i18n}
          copy={copy}
          canExpand={row.getCanExpand()}
          isExpanded={row.getIsExpanded()}
          onToggleExpanded={() => row.toggleExpanded()}
        />
      ) : (
        <SheetValueCell
          column={column}
          row={row.original}
          definition={definition}
          response={response}
          answer={answerRows.get(row.original.source.id)?.cells[column.id]}
          locale={locale}
          i18n={i18n}
          copy={copy}
        />
      ),
  };
}

function ProcedureLabel({
  sheetId,
  row,
  locale,
  i18n,
  copy,
  canExpand,
  isExpanded,
  onToggleExpanded,
}: {
  sheetId: string;
  row: SheetRowModel;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
  canExpand: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const isMobile = useSmartFormV2MobileLayout();
  return (
    <div
      data-smart-form-procedure-depth={row.depth}
      className={cn(
        "relative flex min-w-0 items-start gap-2.5",
        row.depth === 1 && "ml-3 pl-7",
        row.depth === 2 && "ml-6 pl-8",
        row.depth >= 3 && "ml-9 pl-9"
      )}
    >
      {canExpand && !isMobile ? (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className={cn(
            "mt-px size-5 shrink-0 rounded-md border-border bg-background shadow-none",
            tableStyles.headerInteractive
          )}
          aria-label={isExpanded ? copy.collapse : copy.expand}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          {isExpanded ? (
            <Minus className="size-3 opacity-100" />
          ) : (
            <Plus className="size-3 opacity-100" />
          )}
        </Button>
      ) : (
        <span
          data-smart-form-procedure-spacer
          aria-hidden="true"
          className="size-5 shrink-0 sm:size-6"
        />
      )}
      {row.number ? (
        <span
          data-smart-form-number
          className={cn(
            "shrink-0 pt-px tabular-nums text-muted-foreground",
            row.depth === 0 && "text-sm font-medium",
            row.depth === 1 && "text-[0.8125rem] font-normal",
            row.depth >= 2 && "text-xs font-normal"
          )}
        >
          {row.number}
        </span>
      ) : null}
      {row.source.label ? (
        <LocalizedRichText
          value={row.source.label}
          locale={locale}
          i18n={i18n}
          className={cn(
            "min-w-0 leading-5",
            row.depth === 0 && "text-sm font-medium",
            row.depth === 1 && "text-[0.8125rem] font-normal",
            row.depth >= 2 && "text-xs font-normal"
          )}
        />
      ) : null}
      <SmartFormV2ReviewQuestionButton
        target={{
          nodeId: sheetId,
          rowId: row.source.id,
          label: row.source.label
            ? smartFormV2LocalizedPlainText(row.source.label, locale, i18n)
            : row.number || row.source.id,
        }}
      />
    </div>
  );
}

function SheetValueCell({
  column,
  row,
  definition,
  response,
  answer,
  locale,
  i18n,
  copy,
}: {
  column: SmartFormV2SheetLeafColumn;
  row: SheetRowModel;
  definition: SmartFormV2CompiledDefinition;
  response?: SmartFormV2Response;
  answer?: SmartFormV2FieldAnswer;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2ReadonlyCopy;
}) {
  if (!isReadonlySheetCellVisible(row, column, definition, response)) {
    return null;
  }
  const override = row.source.cells?.[column.id];
  if (override?.kind === "empty") {
    return null;
  }
  if (override?.kind === "content") {
    return (
      <LocalizedRichText value={override.content} locale={locale} i18n={i18n} />
    );
  }
  if (column.cell.kind !== "field") {
    return null;
  }

  return (
    <FieldValue
      definition={column.cell.field.value}
      answer={answer}
      locale={locale}
      i18n={i18n}
      copy={copy}
    />
  );
}

export const FieldValue = memo(FieldValueContent);

function FieldValueContent({
  definition,
  answer,
  locale,
  i18n,
  copy,
}: {
  definition: SmartFormV2FieldDefinition;
  answer?: SmartFormV2FieldAnswer;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: Pick<
    SmartFormV2ReadonlyCopy,
    "emptyValue" | "reference" | "attachment"
  >;
}) {
  const value = resolveFieldValue(answer, locale, i18n);
  if (!value || value.type !== definition.type) {
    return <EmptyValue copy={copy} />;
  }

  switch (value.type) {
    case "choice": {
      const selected =
        definition.type === "choice"
          ? definition.options.filter((option) =>
              value.selectedOptionIds.includes(option.id)
            )
          : [];
      if (selected.length === 0) {
        return <EmptyValue copy={copy} />;
      }
      return (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <Badge
              key={option.id}
              variant="outline"
              size="lg"
              className="gap-1 border-border bg-muted/70 px-2 font-semibold text-foreground shadow-none"
            >
              <Check className="size-3.5 opacity-100" />
              <LocalizedRichText
                as="span"
                value={option.label}
                locale={locale}
                i18n={i18n}
              />
            </Badge>
          ))}
        </div>
      );
    }
    case "text": {
      return (
        <p className="text-sm leading-5 break-words whitespace-pre-wrap">
          {value.text || copy.emptyValue}
        </p>
      );
    }
    case "richText": {
      return (
        <RichTextDocument
          document={value.document}
          className="text-sm leading-5"
        />
      );
    }
    case "attachment": {
      if (value.attachments.length === 0) {
        return <EmptyValue copy={copy} />;
      }
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.attachments.map((attachment) => (
            <Badge
              key={attachment.attachmentId}
              variant="outline"
              size="lg"
              className="max-w-full gap-1.5 rounded-md border-border bg-muted/40 px-2.5 font-normal shadow-none"
            >
              <Paperclip className="size-3.5" />
              <span className="truncate">
                {attachment.fileNameSnapshot ??
                  `${copy.attachment} ${attachment.attachmentId}`}
              </span>
            </Badge>
          ))}
        </div>
      );
    }
    case "reference": {
      if (value.references.length === 0) {
        return <EmptyValue copy={copy} />;
      }
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.references.map((reference) => (
            <ReferenceChip
              key={`${reference.targetType}:${reference.targetId}`}
              label={
                reference.labelSnapshot ??
                `${copy.reference} ${reference.targetId}`
              }
              targetId={reference.targetId}
            />
          ))}
        </div>
      );
    }
    case "date": {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {formatDateToken(value.value, locale)}
        </span>
      );
    }
    case "number": {
      return (
        <span className="text-sm tabular-nums">
          {definition.type === "number"
            ? formatNumberValue(value.decimal, definition, locale)
            : value.decimal}
        </span>
      );
    }
    default: {
      return <EmptyValue copy={copy} />;
    }
  }
}

function ReferenceChip({
  label,
  targetId,
}: {
  label: string;
  targetId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            data-smart-form-reference
            variant="outline"
            size="lg"
            className="max-w-full cursor-default gap-1.5 rounded-md border-border bg-muted/55 px-2.5 font-medium text-foreground shadow-none"
          />
        }
      >
        <Link2 className={cn("size-3.5", tableStyles.headerForeground)} />
        <span className="truncate">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{targetId}</TooltipContent>
    </Tooltip>
  );
}

function EmptyValue({
  copy,
}: {
  copy: Pick<SmartFormV2ReadonlyCopy, "emptyValue">;
}) {
  return (
    <span
      className="text-sm text-muted-foreground"
      aria-label={copy.emptyValue}
    >
      —
    </span>
  );
}

export const LocalizedRichText = memo(LocalizedRichTextContent);

function LocalizedRichTextContent({
  value,
  locale,
  i18n,
  as,
  className,
}: {
  value: SmartFormV2LocalizedRichText;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  as?: "div" | "h1" | "h2" | "h3" | "span";
  className?: string;
}) {
  const document = resolveLocalized(value, locale, i18n);
  if (!document) {
    return null;
  }
  if (as) {
    return createElement(
      as,
      { className },
      <RichTextInlineDocument document={document} />
    );
  }
  const content = <RichTextDocument document={document} />;
  return <div className={className}>{content}</div>;
}

function RichTextInlineDocument({
  document,
}: {
  document: SmartFormV2RichTextDocument;
}) {
  return (
    <>
      {document.content.map((block, index) => (
        <Fragment key={block.id}>
          {index > 0 ? " " : null}
          {block.type === "paragraph" || block.type === "heading" ? (
            <RichTextInlines content={block.content} />
          ) : block.type === "embed" ? (
            (block.labelSnapshot ?? block.entityId)
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

export type RichTextReference = Pick<
  Extract<SmartFormV2RichTextBlock, { type: "embed" }>,
  "entityId" | "entityType" | "labelSnapshot"
>;
const RichTextReferenceContext = createContext<
  ((reference: RichTextReference) => ReactNode) | undefined
>(undefined);
const RichTextLinkContext = createContext<
  ((href: string, label: ReactNode) => ReactNode) | undefined
>(undefined);

function RichTextReferenceView({
  reference,
}: {
  reference: RichTextReference;
}) {
  const render = useContext(RichTextReferenceContext);
  return render ? (
    render(reference)
  ) : (
    <ReferenceChip
      label={reference.labelSnapshot ?? reference.entityId}
      targetId={reference.entityId}
    />
  );
}

export function RichTextDocument({
  document,
  className,
  renderReference,
  renderLink,
}: {
  document: SmartFormV2RichTextDocument;
  className?: string;
  renderReference?: (reference: RichTextReference) => ReactNode;
  renderLink?: (href: string, label: ReactNode) => ReactNode;
}) {
  return (
    <RichTextReferenceContext.Provider value={renderReference}>
      <RichTextLinkContext.Provider value={renderLink}>
        <div className={cn("min-w-0 break-words", className)}>
          {document.content.map((block) => (
            <RichTextBlock key={block.id} block={block} />
          ))}
        </div>
      </RichTextLinkContext.Provider>
    </RichTextReferenceContext.Provider>
  );
}

function RichTextBlock({ block }: { block: SmartFormV2RichTextBlock }) {
  switch (block.type) {
    case "paragraph": {
      return (
        <p>
          <RichTextInlines content={block.content} />
        </p>
      );
    }
    case "heading": {
      return createElement(
        `h${block.level}`,
        { className: "font-semibold" },
        <RichTextInlines content={block.content} />
      );
    }
    case "bulletList":
    case "orderedList": {
      const List = block.type === "bulletList" ? "ul" : "ol";
      return (
        <List
          className={cn(
            "my-1 space-y-1 pl-5",
            block.type === "bulletList" ? "list-disc" : "list-decimal"
          )}
        >
          {block.items.map((item) => (
            <li key={item.id}>
              {item.content.map((child) => (
                <RichTextBlock key={child.id} block={child} />
              ))}
            </li>
          ))}
        </List>
      );
    }
    case "blockquote": {
      return (
        <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
          {block.content.map((child) => (
            <RichTextBlock key={child.id} block={child} />
          ))}
        </blockquote>
      );
    }
    case "table": {
      return (
        <Table className="my-2">
          <TableBody>
            {block.rows.map((row) => (
              <TableRow key={row.id}>
                {row.cells.map((cell) => (
                  <TableCell key={cell.id} className="whitespace-normal">
                    {cell.content.map((child) => (
                      <RichTextBlock key={child.id} block={child} />
                    ))}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
    case "embed": {
      return (
        <div className="min-w-0">
          <RichTextReferenceView reference={block} />
        </div>
      );
    }
    default: {
      return null;
    }
  }
}

function RichTextInlines({
  content,
}: {
  content: SmartFormV2RichTextInline[];
}) {
  const renderLink = useContext(RichTextLinkContext);
  return (
    <>
      {content.map((inline, index) => {
        if (inline.type === "hardBreak") {
          return <br key={`break-${index}`} />;
        }
        if (inline.type === "entityReference") {
          return (
            <Fragment key={inline.id}>
              <RichTextReferenceView reference={inline} />
            </Fragment>
          );
        }
        return (
          <Fragment key={`text-${index}`}>
            {applyRichTextMarks(inline.text, inline.marks ?? [], renderLink)}
          </Fragment>
        );
      })}
    </>
  );
}

function applyRichTextMarks(
  text: string,
  marks: Exclude<
    SmartFormV2RichTextInline,
    { type: "hardBreak" | "entityReference" }
  >["marks"],
  renderLink?: (href: string, label: ReactNode) => ReactNode
) {
  return (marks ?? []).reduceRight<ReactNode>((content, mark, index) => {
    switch (mark.type) {
      case "bold": {
        return <strong key={index}>{content}</strong>;
      }
      case "italic": {
        return <em key={index}>{content}</em>;
      }
      case "underline": {
        return <u key={index}>{content}</u>;
      }
      case "strike": {
        return <s key={index}>{content}</s>;
      }
      case "code": {
        return (
          <code key={index} className="rounded bg-muted px-1 font-mono text-xs">
            {content}
          </code>
        );
      }
      case "link": {
        if (renderLink) {
          return (
            <Fragment key={index}>{renderLink(mark.href, content)}</Fragment>
          );
        }
        return (
          <a
            key={index}
            href={mark.href}
            className="text-primary underline underline-offset-2"
            rel="noreferrer"
            target="_blank"
          >
            {content}
          </a>
        );
      }
      default: {
        return content;
      }
    }
  }, text);
}

export function resolveLocalized(
  value: SmartFormV2LocalizedRichText,
  locale: string,
  i18n: SmartFormV2I18nConfig
) {
  const candidates = [
    locale,
    ...(i18n.fallbackLocales?.[locale] ?? []),
    i18n.defaultLocale,
    ...i18n.supportedLocales,
  ];
  for (const candidate of candidates) {
    const document = value.values[candidate];
    if (document) {
      return document;
    }
  }
  return Object.values(value.values)[0];
}

function resolveFieldValue(
  answer: SmartFormV2FieldAnswer | undefined,
  locale: string,
  i18n: SmartFormV2I18nConfig
): SmartFormV2FieldValue | undefined {
  if (!answer) {
    return undefined;
  }
  if (answer.type !== "localized") {
    return answer;
  }
  const candidates = [
    locale,
    ...(i18n.fallbackLocales?.[locale] ?? []),
    i18n.defaultLocale,
    ...i18n.supportedLocales,
  ];
  for (const candidate of candidates) {
    const value = answer.values[candidate];
    if (value) {
      return value;
    }
  }
  return Object.values(answer.values)[0];
}

function buildSheetRows(
  rows: SmartFormV2FixedSheetRow[],
  numbering?: SmartFormV2NumberingRule,
  depth = 0,
  parentNumber = ""
): SheetRowModel[] {
  return rows.map((source, index) => {
    const rule = numberingForDepth(numbering, depth);
    const ownNumber = rule?.enabled
      ? `${rule.prefix ?? ""}${formatOrdinal(
          (rule.startAt ?? 1) + index,
          rule.style
        )}${rule.suffix ?? ""}`
      : "";
    const number = parentNumber
      ? `${parentNumber}${rule?.separator ?? ""}${ownNumber}`
      : ownNumber;
    return {
      source,
      number,
      depth,
      children: source.children?.length
        ? buildSheetRows(source.children, numbering, depth + 1, number)
        : undefined,
    };
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

export function formatOrdinal(
  value: number,
  numberingStyle: SmartFormV2NumberingRule["style"]
) {
  if (numberingStyle === "decimal") {
    return String(value);
  }
  if (numberingStyle === "lower-alpha" || numberingStyle === "upper-alpha") {
    let remaining = value;
    let output = "";
    while (remaining > 0) {
      remaining -= 1;
      output = String.fromCodePoint(97 + (remaining % 26)) + output;
      remaining = Math.floor(remaining / 26);
    }
    return numberingStyle === "upper-alpha" ? output.toUpperCase() : output;
  }
  const roman = toRoman(value);
  return numberingStyle === "upper-roman" ? roman : roman.toLowerCase();
}

function toRoman(value: number) {
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
  return output;
}

function isReadonlySheetCellVisible(
  row: SheetRowModel,
  column: SmartFormV2SheetLeafColumn,
  definition: SmartFormV2CompiledDefinition,
  response?: SmartFormV2Response
) {
  const override = row.source.cells?.[column.id];
  return !(
    response &&
    override?.kind === "field" &&
    !isSmartFormV2ExpressionTrue(definition, response, override.visibleWhen)
  );
}

function sheetColumnClassName(columnId: string) {
  switch (columnId) {
    case "procedure": {
      return "w-[42%]";
    }
    case "test-required": {
      return "w-[13%]";
    }
    case "result": {
      return "w-[15%]";
    }
    case "working-paper-reference": {
      return "w-[15%]";
    }
    case "comments": {
      return "w-[15%]";
    }
    default: {
      return "";
    }
  }
}

function nodeDepthInsetClassName(depth: number) {
  if (depth <= 0) {
    return "";
  }
  if (depth === 1) {
    return "w-full md:ms-9 md:w-[calc(100%-2.25rem)]";
  }
  if (depth === 2) {
    return "w-full md:ms-16 md:w-[calc(100%-4rem)]";
  }
  return "w-full md:ms-20 md:w-[calc(100%-5rem)]";
}

function nodeContentInsetClassName(depth: number) {
  return depth <= 0 ? "py-4 md:px-8 md:py-7" : nodeDepthInsetClassName(depth);
}

function smartFormSectionClassName(depth: number) {
  return depth <= 0
    ? "py-4 md:px-8 md:py-7"
    : "py-1 md:border-s-2 md:border-s-border/70 md:ps-5";
}

function staticContentGutterClassName(depth: number) {
  return depth <= 0 ? "py-4 md:px-8 md:py-6" : nodeDepthInsetClassName(depth);
}

function formatDateToken(value: string, locale: string) {
  if (value.length !== 10) {
    return value;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatNumberValue(
  decimal: string,
  definition: Extract<SmartFormV2FieldDefinition, { type: "number" }>,
  locale: string
) {
  const value = Number(decimal);
  if (!Number.isFinite(value)) {
    return decimal;
  }
  const options: Intl.NumberFormatOptions =
    definition.format === "currency"
      ? {
          style: "currency",
          currency: definition.currencyCode,
          maximumFractionDigits: definition.scale,
        }
      : definition.format === "percent"
        ? {
            style: "percent",
            maximumFractionDigits: definition.scale,
          }
        : {
            maximumFractionDigits: definition.scale,
          };
  return new Intl.NumberFormat(locale, options).format(value);
}
