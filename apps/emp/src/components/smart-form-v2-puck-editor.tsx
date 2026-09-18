"use client";

import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2Definition,
  SmartFormV2FieldDefinition,
  SmartFormV2FixedSheetRow,
  SmartFormV2Node,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  compileSmartFormV2Definition,
} from "@project-wing/shared";
import { ActionBar, Drawer, Puck, createUsePuck } from "@puckeditor/core";
import type { ComponentData, Config, Data, Slot } from "@puckeditor/core";
import {
  Check,
  Eye,
  FileQuestion,
  GitBranch,
  Languages,
  ListTree,
  MoreHorizontal,
  Pencil,
  Pilcrow,
  Redo2,
  Save,
  Table2,
  Undo2,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/extend/ui/badge";
import { Button } from "@/components/extend/ui/button";
import { Input } from "@/components/extend/ui/input";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

import { SmartFormV2Editor } from "./smart-form-v2-editor";
import { SmartFormV2RequiredIndicator } from "./smart-form-v2-required-indicator";

const NOOP = () => {};

export const SMART_FORM_PUCK_COMPONENTS = {
  section: "Section",
  staticText: "StaticText",
  question: "Question",
  table: "Table",
  conditional: "Conditional",
} as const;

export type SmartFormPuckCopy = {
  section: string;
  staticText: string;
  question: string;
  table: string;
  conditional: string;
  conditionMatched: string;
  conditionOtherwise: string;
  conditionSelected: string;
  conditionIncludesAny: string;
  conditionIncludesAll: string;
  conditionIf: string;
  conditionElseIf: string;
  branchQuestionPlaceholder: string;
  insert: string;
  editGroup: string;
  viewGroup: string;
  undo: string;
  redo: string;
  moreCommands: string;
  preview: string;
  language: string;
  languageChinese: string;
  languageEnglish: string;
  translationMode: string;
  chineseReference: string;
  save: string;
  saved: string;
  unsaved: string;
  edit: string;
  required: string;
  optional: string;
  emptyValue: string;
  dropIntoSection: string;
  dropIntoDocument: string;
  sectionTitlePlaceholder: string;
  staticTextPlaceholder: string;
  fieldLabelPlaceholder: string;
  tableTitlePlaceholder: string;
  rowHeader: string;
  columnHeader: string;
  rowLabel: string;
  yes: string;
  no: string;
  singleChoice: string;
  multipleChoice: string;
  text: string;
  richText: string;
  number: string;
  reference: string;
  attachment: string;
  date: string;
};

type SectionProps = {
  sourceJson?: string;
  title: string;
  description: string;
  content: Slot;
};

type StaticTextProps = {
  sourceJson?: string;
  text: string;
};

type QuestionProps = {
  sourceJson?: string;
  label: string;
  help: string;
  answerType: SmartFormPuckAnswerType;
  required: boolean;
  options: string[];
};

type TableColumnPreview = {
  id: string;
  label: string;
  required: boolean;
};

type TableRowPreview = {
  id: string;
  label: string;
  role: "data" | "group";
  depth: number;
};

type TableProps = {
  sourceJson?: string;
  title: string;
  description: string;
  rowHeader: string;
  columns: TableColumnPreview[];
  rows: TableRowPreview[];
};

type ConditionalProps = {
  sourceJson?: string;
  questionLabel: string;
  questionType: "singleChoice" | "multipleChoice" | "number";
  required: boolean;
  comparisonLabels: string[];
  expectedLabels: string[];
  branch0: Slot;
  branch1: Slot;
  branch2: Slot;
  branch3: Slot;
  branch4: Slot;
  branch5: Slot;
  branch6: Slot;
  branch7: Slot;
  otherwise: Slot;
};

type SmartFormPuckProps = {
  Section: SectionProps;
  StaticText: StaticTextProps;
  Question: QuestionProps;
  Table: TableProps;
  Conditional: ConditionalProps;
};

export type SmartFormPuckData = Data<SmartFormPuckProps>;
type SmartFormPuckConfig = Config<SmartFormPuckProps>;

const useSmartFormPuck = createUsePuck<SmartFormPuckConfig>();

type SmartFormPuckAnswerType =
  | "singleChoice"
  | "multipleChoice"
  | "text"
  | "richText"
  | "number"
  | "reference"
  | "attachment"
  | "date";

type SmartFormPuckEditorProps = {
  definition: SmartFormV2Definition;
  compiledDefinition?: SmartFormV2CompiledDefinition;
  locale: string;
  defaultLocale?: string;
  supportedLocales?: string[];
  onLocaleChange?: (locale: string) => void;
  copy: SmartFormPuckCopy;
  dirty: boolean;
  saveError?: string;
  headerActions?: ReactNode;
  headerContext?: string;
  headerSubtitle?: string;
  headerTitle?: string;
  onChange: (definition: SmartFormV2Definition) => void;
  onEditNode: (nodeId: string) => void;
  onSave: () => void;
  className?: string;
};

type EditorContextValue = {
  copy: SmartFormPuckCopy;
  dirty: boolean;
  saveError?: string;
  headerActions?: ReactNode;
  headerContext?: string;
  headerSubtitle?: string;
  headerTitle?: string;
  onDocumentDescriptionChange: (value: string) => void;
  onDocumentTitleChange: (value: string) => void;
  onEditNode: (nodeId: string) => void;
  onPreview?: () => void;
  onSave: () => void;
  structureLocked: boolean;
  locale: string;
  supportedLocales: string[];
  onLocaleChange: (locale: string) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function SmartFormV2PuckEditor({
  definition,
  compiledDefinition,
  locale,
  defaultLocale: providedDefaultLocale,
  supportedLocales: providedSupportedLocales,
  onLocaleChange = NOOP,
  copy,
  dirty,
  saveError,
  headerActions,
  headerContext,
  headerSubtitle,
  headerTitle,
  onChange,
  onEditNode,
  onSave,
  className,
}: SmartFormPuckEditorProps) {
  const defaultLocale = providedDefaultLocale ?? definition.i18n.defaultLocale;
  const supportedLocales =
    providedSupportedLocales ?? definition.i18n.supportedLocales;
  const structureLocked = locale !== defaultLocale;
  const config = useMemo(() => createSmartFormPuckConfig(copy), [copy]);
  const data = useMemo(
    () => definitionToPuckData(definition, compiledDefinition, locale, copy),
    [compiledDefinition, copy, definition, locale]
  );
  const [runtimePreviewDefinition, setRuntimePreviewDefinition] =
    useState<SmartFormV2CompiledDefinition>();
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const metadata = useMemo(
    () => ({
      documentTitle: readLocalizedExact(definition.title, locale),
      documentDescription: readLocalizedExact(definition.description, locale),
      documentTitleReference: structureLocked
        ? readLocalizedExact(definition.title, defaultLocale)
        : "",
      documentDescriptionReference: structureLocked
        ? readLocalizedExact(definition.description, defaultLocale)
        : "",
      dropIntoDocument: copy.dropIntoDocument,
    }),
    [
      copy.dropIntoDocument,
      defaultLocale,
      definition.description,
      definition.title,
      locale,
      structureLocked,
    ]
  );
  const contextValue = useMemo<EditorContextValue>(
    () => ({
      copy,
      dirty,
      saveError,
      headerActions,
      headerContext,
      headerSubtitle,
      headerTitle,
      onDocumentDescriptionChange: (value) =>
        onChange({
          ...definition,
          description: updateOptionalLocalizedDocumentText(
            definition.description,
            value,
            locale,
            `${definition.id}-description`,
            definition.i18n.supportedLocales
          ),
        }),
      onDocumentTitleChange: (value) =>
        onChange({
          ...definition,
          title: updateLocalizedDocumentText(
            definition.title,
            value,
            locale,
            `${definition.id}-title`,
            definition.i18n.supportedLocales
          ),
        }),
      onEditNode,
      onPreview: headerActions
        ? () => {
            try {
              setRuntimePreviewDefinition(
                compileSmartFormV2Definition(
                  definition,
                  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
                )
              );
            } catch {
              // The designer already surfaces the compile error in its status area.
            }
          }
        : undefined,
      onSave,
      structureLocked,
      locale,
      supportedLocales,
      onLocaleChange,
    }),
    [
      copy,
      definition,
      dirty,
      headerActions,
      headerContext,
      headerSubtitle,
      headerTitle,
      locale,
      onChange,
      onEditNode,
      onSave,
      onLocaleChange,
      saveError,
      structureLocked,
      supportedLocales,
    ]
  );

  return (
    <EditorContext.Provider value={contextValue}>
      <div
        className={cn(
          "smart-form-puck-editor h-full min-h-0 bg-muted/25 text-foreground",
          className
        )}
      >
        <Puck
          config={config}
          data={data}
          height="100%"
          iframe={{ enabled: false }}
          metadata={metadata}
          permissions={{
            drag: !structureLocked,
            duplicate: false,
            delete: !structureLocked,
            edit: true,
            insert: !structureLocked,
          }}
          ui={{
            leftSideBarVisible: false,
            rightSideBarVisible: false,
            previewMode: "edit",
          }}
          overrides={{ actionBar: SmartFormActionBar }}
          onChange={(nextData) => {
            if (!mountedRef.current || structureLocked) {
              return;
            }
            onChange(puckDataToDefinition(nextData, definition, copy));
          }}
        >
          <PuckDataSync
            data={data}
            definition={definition}
            locale={locale}
            copy={copy}
          />
          <SmartFormRibbon />
          <div className="min-h-0 flex-1 overflow-auto bg-muted/35 p-3 md:p-5">
            <Puck.Preview />
          </div>
        </Puck>
      </div>
      {runtimePreviewDefinition ? (
        <SmartFormRuntimePreviewDialog
          definition={runtimePreviewDefinition}
          locale={locale}
          title={copy.preview}
          onClose={() => setRuntimePreviewDefinition(undefined)}
        />
      ) : null}
    </EditorContext.Provider>
  );
}

function SmartFormRuntimePreviewDialog({
  definition,
  locale,
  title,
  onClose,
}: {
  definition: SmartFormV2CompiledDefinition;
  locale: string;
  title: string;
  onClose: () => void;
}) {
  const { dictionary } = useI18n();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-screen w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div
          data-testid="smart-form-runtime-preview"
          className="min-h-0 flex-1 overflow-auto bg-muted/18 p-3 md:p-5"
        >
          <SmartFormV2Editor
            definition={definition}
            locale={locale}
            copy={dictionary.smartFormV2Editor}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PuckDataSync({
  data,
  definition,
  locale,
  copy,
}: {
  data: SmartFormPuckData;
  definition: SmartFormV2Definition;
  locale: string;
  copy: SmartFormPuckCopy;
}) {
  const currentData = useSmartFormPuck((state) => state.appState.data);
  const dispatch = useSmartFormPuck((state) => state.dispatch);
  const syncedLocaleRef = useRef(locale);
  const currentDefinitionFingerprint = JSON.stringify(
    puckDataToDefinition(currentData as SmartFormPuckData, definition, copy)
  );
  const nextDefinitionFingerprint = JSON.stringify(definition);

  useEffect(() => {
    if (syncedLocaleRef.current !== locale) {
      syncedLocaleRef.current = locale;
      dispatch({ type: "setData", data, recordHistory: false });
      return;
    }
    if (currentDefinitionFingerprint === nextDefinitionFingerprint) {
      return;
    }
    dispatch({ type: "setData", data, recordHistory: true });
  }, [
    currentDefinitionFingerprint,
    data,
    dispatch,
    locale,
    nextDefinitionFingerprint,
  ]);

  return null;
}

function SmartFormRibbon() {
  const context = useEditorContext();
  const previewMode = useSmartFormPuck(
    (state) => state.appState.ui.previewMode
  );
  const dispatch = useSmartFormPuck((state) => state.dispatch);
  const historyBack = useSmartFormPuck((state) => state.history.back);
  const historyForward = useSmartFormPuck((state) => state.history.forward);
  const hasPast = useSmartFormPuck((state) => state.history.hasPast);
  const hasFuture = useSmartFormPuck((state) => state.history.hasFuture);
  const interactive = previewMode === "interactive";
  const togglePreview = () => {
    if (context.onPreview) {
      context.onPreview();
      return;
    }
    dispatch({
      type: "setUi",
      ui: { previewMode: interactive ? "edit" : "interactive" },
    });
  };

  return (
    <header className="smart-form-puck-ribbon sticky top-0 z-30 border-b border-border bg-background/95 shadow-xs/5 backdrop-blur">
      <div className="flex min-h-11 items-center gap-2 border-b border-border/70 px-3">
        <div className="min-w-0 flex-1">
          {context.headerTitle ? (
            <p className="truncate text-sm font-semibold text-foreground">
              {context.headerTitle}
            </p>
          ) : null}
          {context.headerSubtitle ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {context.headerSubtitle} ·{" "}
              {localeLabel(context.locale, context.copy)}
              {context.headerContext ? ` · ${context.headerContext}` : ""}
            </p>
          ) : null}
        </div>
        <span
          role={context.saveError ? "alert" : "status"}
          className={cn(
            "flex max-w-48 items-center gap-1 truncate text-[11px] text-muted-foreground",
            context.saveError && "text-destructive"
          )}
        >
          {context.saveError ? null : (
            <Check className="size-3.5 text-primary" />
          )}
          {context.saveError ??
            (context.dirty ? context.copy.unsaved : context.copy.saved)}
        </span>
        <ButtonGroup>
          {context.headerActions}
          <Button
            type="button"
            size="sm"
            disabled={!context.dirty}
            onClick={() => context.onSave()}
          >
            <Save className="size-4" />
            {context.copy.save}
          </Button>
        </ButtonGroup>
      </div>

      <div
        aria-label={`${context.copy.insert} · ${context.copy.editGroup} · ${context.copy.viewGroup}`}
        className="flex min-h-12 items-center gap-1 overflow-hidden px-2 py-1.5 font-sans [&_button]:!font-sans [&_button]:!text-sm [&_button]:!font-normal [&_button_div]:!font-sans [&_button_div]:!text-sm [&_button_div]:!font-normal [&_button_span]:!font-sans [&_button_span]:!text-sm [&_button_span]:!font-normal"
        role="toolbar"
      >
        {context.structureLocked ? null : (
          <RibbonGroup>
            <Drawer>
              <Drawer.Item
                name={SMART_FORM_PUCK_COMPONENTS.section}
                label={context.copy.section}
              >
                {() => (
                  <RibbonItem
                    icon={<ListTree />}
                    label={context.copy.section}
                  />
                )}
              </Drawer.Item>
              <Drawer.Item
                name={SMART_FORM_PUCK_COMPONENTS.staticText}
                label={context.copy.staticText}
              >
                {() => (
                  <RibbonItem
                    icon={<Pilcrow />}
                    label={context.copy.staticText}
                  />
                )}
              </Drawer.Item>
              <Drawer.Item
                name={SMART_FORM_PUCK_COMPONENTS.question}
                label={context.copy.question}
              >
                {() => (
                  <RibbonItem
                    icon={<FileQuestion />}
                    label={context.copy.question}
                  />
                )}
              </Drawer.Item>
              <Drawer.Item
                name={SMART_FORM_PUCK_COMPONENTS.conditional}
                label={context.copy.conditional}
              >
                {() => (
                  <RibbonItem
                    icon={<GitBranch />}
                    label={context.copy.conditional}
                  />
                )}
              </Drawer.Item>
              <Drawer.Item
                name={SMART_FORM_PUCK_COMPONENTS.table}
                label={context.copy.table}
              >
                {() => (
                  <RibbonItem icon={<Table2 />} label={context.copy.table} />
                )}
              </Drawer.Item>
            </Drawer>
          </RibbonGroup>
        )}

        <RibbonSeparator />
        <RibbonGroup>
          <ButtonGroup>
            <RibbonCommand
              icon={<Undo2 />}
              label={context.copy.undo}
              disabled={!hasPast || context.structureLocked}
              onClick={historyBack}
            />
            <span className="max-lg:hidden">
              <RibbonCommand
                icon={<Redo2 />}
                label={context.copy.redo}
                disabled={!hasFuture || context.structureLocked}
                onClick={historyForward}
              />
            </span>
          </ButtonGroup>
        </RibbonGroup>

        <RibbonSeparator />
        <RibbonGroup>
          <ButtonGroup>
            <RibbonCommand
              icon={<Eye />}
              label={context.copy.preview}
              active={context.onPreview ? false : interactive}
              onClick={togglePreview}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 px-2.5 !font-sans !text-sm !font-normal max-lg:hidden [&_svg]:size-4"
                  />
                }
              >
                <Languages />
                <span className="!font-sans !text-sm !font-normal">
                  {localeLabel(context.locale, context.copy)}
                </span>
              </DropdownMenuTrigger>
              <LocaleMenu context={context} />
            </DropdownMenu>
          </ButtonGroup>
        </RibbonGroup>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto hidden max-lg:inline-flex"
                aria-label={context.copy.moreCommands}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              disabled={!hasFuture || context.structureLocked}
              onClick={historyForward}
            >
              <Redo2 />
              {context.copy.redo}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{context.copy.language}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={context.locale}
                onValueChange={(nextLocale) =>
                  context.onLocaleChange(nextLocale)
                }
              >
                {context.supportedLocales.map((supportedLocale) => (
                  <DropdownMenuRadioItem
                    key={supportedLocale}
                    value={supportedLocale}
                  >
                    {localeLabel(supportedLocale, context.copy)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function LocaleMenu({ context }: { context: EditorContextValue }) {
  return (
    <DropdownMenuContent align="start" className="min-w-40">
      <DropdownMenuGroup>
        <DropdownMenuLabel>{context.copy.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={context.locale}
          onValueChange={(nextLocale) => context.onLocaleChange(nextLocale)}
        >
          {context.supportedLocales.map((supportedLocale) => (
            <DropdownMenuRadioItem
              key={supportedLocale}
              value={supportedLocale}
            >
              {localeLabel(supportedLocale, context.copy)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function RibbonSeparator() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 mt-1 h-7 w-px shrink-0 bg-border"
    />
  );
}

function RibbonGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-1">{children}</div>
  );
}

function RibbonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 !font-sans !text-sm !font-normal text-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 max-lg:size-8 max-lg:px-0 [&_svg]:size-4">
      {icon}
      <span className="max-lg:sr-only">{label}</span>
    </div>
  );
}

function RibbonCommand({
  icon,
  label,
  disabled,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      disabled={disabled}
      className="h-9 gap-1.5 px-2.5 !font-sans !text-sm !font-normal max-lg:size-8 max-lg:px-0 [&_svg]:size-4"
      onClick={onClick}
    >
      {icon}
      <span className="max-lg:sr-only">{label}</span>
    </Button>
  );
}

function localeLabel(locale: string, copy: SmartFormPuckCopy) {
  if (locale.toLowerCase().startsWith("zh")) {
    return copy.languageChinese;
  }
  if (locale.toLowerCase().startsWith("en")) {
    return copy.languageEnglish;
  }
  return locale;
}

function SmartFormActionBar({
  label,
  children,
  parentAction,
}: {
  label?: string;
  children: ReactNode;
  parentAction: ReactNode;
}) {
  const context = useEditorContext();
  const selectedItem = useSmartFormPuck((state) => state.selectedItem);

  return (
    <>
      {context.structureLocked ? null : parentAction}
      <ActionBar label={label}>
        <ActionBar.Group>
          <ActionBar.Action
            label={context.copy.edit}
            disabled={!selectedItem}
            onClick={() => {
              if (selectedItem?.props.id) {
                context.onEditNode(selectedItem.props.id);
              }
            }}
          >
            <Pencil className="size-4" />
          </ActionBar.Action>
        </ActionBar.Group>
        {context.structureLocked ? null : children}
      </ActionBar>
    </>
  );
}

function CanvasBlockTypeIcon({
  type,
}: {
  type: "section" | "staticText" | "question" | "table" | "conditional";
}) {
  const Icon =
    type === "section"
      ? ListTree
      : type === "staticText"
        ? Pilcrow
        : type === "question"
          ? FileQuestion
          : type === "table"
            ? Table2
            : GitBranch;

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-5 shrink-0 items-center justify-center text-primary/75 [&_svg]:size-4"
      data-smart-form-block-icon={type}
    >
      <Icon />
    </span>
  );
}

function createSmartFormPuckConfig(
  copy: SmartFormPuckCopy
): SmartFormPuckConfig {
  return {
    components: {
      Section: {
        label: copy.section,
        fields: {
          title: { type: "text", label: copy.section },
          description: { type: "textarea", label: copy.staticText },
          content: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
        },
        defaultProps: {
          title: copy.sectionTitlePlaceholder,
          description: "",
          content: [],
        },
        render: ({ title, description, content: Content }) => (
          <section
            className="my-6 border-t border-border/70 pt-5 first:mt-0"
            data-smart-form-hierarchy="section"
          >
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <CanvasBlockTypeIcon type="section" />
                <h2 className="text-base font-semibold tracking-tight">
                  {title}
                </h2>
              </div>
              {description ? (
                <p className="mt-1 pl-2.5 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <div
              className="smart-form-puck-slot-wrap relative ml-2 border-l-2 border-primary/20 pl-4"
              data-smart-form-hierarchy="section-children"
            >
              <Content
                allow={Object.values(SMART_FORM_PUCK_COMPONENTS)}
                className="smart-form-puck-slot space-y-3"
                minEmptyHeight={72}
              />
              <span className="smart-form-puck-slot-label pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-xs font-medium text-primary">
                {copy.dropIntoSection}
              </span>
            </div>
          </section>
        ),
      },
      StaticText: {
        label: copy.staticText,
        defaultProps: {
          text: copy.staticTextPlaceholder,
        },
        render: ({ text }) => (
          <div className="flex items-start gap-2 border-b border-border/60 px-0 py-3">
            <CanvasBlockTypeIcon type="staticText" />
            <p className="text-sm leading-6 whitespace-pre-wrap">{text}</p>
          </div>
        ),
      },
      Question: {
        label: copy.question,
        defaultProps: {
          label: copy.fieldLabelPlaceholder,
          help: "",
          answerType: "text",
          required: false,
          options: [copy.yes, copy.no],
        },
        render: ({ label, help, answerType, required, options }) => (
          <div className="rounded-md border border-border/70 bg-muted/10 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <CanvasBlockTypeIcon type="question" />
              <p className="text-sm font-medium">{label}</p>
              <SmartFormV2RequiredIndicator
                required={required}
                requiredLabel={copy.required}
                optionalLabel={copy.optional}
              />
              <Badge variant="outline">
                {answerTypeLabel(answerType, copy)}
              </Badge>
            </div>
            {help ? (
              <p className="mt-1 text-xs text-muted-foreground">{help}</p>
            ) : null}
            <div className="mt-3 rounded-md border border-input bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
              {answerType === "singleChoice" || answerType === "multipleChoice"
                ? options.join(" / ")
                : copy.emptyValue}
            </div>
          </div>
        ),
      },
      Table: {
        label: copy.table,
        defaultProps: {
          title: copy.tableTitlePlaceholder,
          description: "",
          rowHeader: copy.rowHeader,
          columns: [
            { id: "answer", label: copy.columnHeader, required: false },
          ],
          rows: [{ id: "row", label: copy.rowLabel, role: "data", depth: 0 }],
        },
        render: ({ title, description, rowHeader, columns, rows }) => (
          <div className="overflow-hidden rounded-md border border-border/70 bg-background">
            {title || description ? (
              <div className="flex items-start gap-2 border-b border-border px-4 py-3">
                <CanvasBlockTypeIcon type="table" />
                <div>
                  {title ? (
                    <p className="text-sm font-semibold">{title}</p>
                  ) : null}
                  {description ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <Table label={title || copy.table}>
              <TableHeader>
                <TableRow className="border-[var(--smart-form-table-header-border)] bg-[var(--smart-form-table-header)] hover:bg-[var(--smart-form-table-header)] hover:shadow-none">
                  <TableHead className="min-w-60 text-[var(--smart-form-table-header-foreground)]">
                    <span className="flex items-center gap-2">
                      {title || description ? null : (
                        <CanvasBlockTypeIcon type="table" />
                      )}
                      {rowHeader}
                    </span>
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.id}
                      className="min-w-36 text-[var(--smart-form-table-header-foreground)]"
                    >
                      <span className="inline-flex items-start gap-1">
                        {column.label}
                        <SmartFormV2RequiredIndicator
                          required={column.required}
                          requiredLabel={copy.required}
                          optionalLabel={copy.optional}
                        />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const label = row.depth
                    ? `${"　".repeat(row.depth)}${row.label}`
                    : row.label;
                  if (row.role === "group") {
                    return (
                      <TableRow
                        key={row.id}
                        className="bg-[var(--smart-form-table-group)]"
                      >
                        <TableCell
                          colSpan={columns.length + 1}
                          className="border-l-2 border-l-[var(--smart-form-table-group-accent)] font-semibold whitespace-normal"
                        >
                          {label}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium whitespace-normal">
                        {label}
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          className="text-muted-foreground"
                        >
                          {copy.emptyValue}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ),
      },
      Conditional: {
        label: copy.conditional,
        fields: {
          questionLabel: { type: "text", label: copy.question },
          questionType: {
            type: "select",
            label: copy.question,
            options: [
              { label: copy.singleChoice, value: "singleChoice" },
              { label: copy.multipleChoice, value: "multipleChoice" },
              { label: copy.number, value: "number" },
            ],
          },
          required: {
            type: "custom",
            render: () => <span hidden />,
          },
          comparisonLabels: {
            type: "custom",
            render: () => <span hidden />,
          },
          expectedLabels: {
            type: "custom",
            render: () => <span hidden />,
          },
          branch0: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch1: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch2: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch3: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch4: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch5: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch6: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          branch7: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
          otherwise: {
            type: "slot",
            allow: Object.values(SMART_FORM_PUCK_COMPONENTS),
          },
        },
        defaultProps: {
          questionLabel: copy.branchQuestionPlaceholder,
          questionType: "singleChoice",
          required: false,
          comparisonLabels: [copy.conditionSelected],
          expectedLabels: [copy.yes],
          branch0: [],
          branch1: [],
          branch2: [],
          branch3: [],
          branch4: [],
          branch5: [],
          branch6: [],
          branch7: [],
          otherwise: [],
        },
        render: (props) => {
          const {
            questionLabel,
            questionType,
            required,
            comparisonLabels,
            expectedLabels,
            otherwise: Otherwise,
          } = props;
          const branchSlots = [
            props.branch0,
            props.branch1,
            props.branch2,
            props.branch3,
            props.branch4,
            props.branch5,
            props.branch6,
            props.branch7,
          ];
          return (
            <article className="relative py-2">
              <span
                aria-hidden="true"
                className="absolute top-11 bottom-3 left-3 w-px bg-primary/45"
              />
              <div className="flex min-w-0 flex-wrap items-center gap-2 px-2 py-1.5 text-sm font-semibold text-foreground">
                <CanvasBlockTypeIcon type="conditional" />
                <span>{copy.conditional}</span>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-muted/25 px-3 py-1 text-xs font-medium text-foreground shadow-xs/5">
                  <span className="max-w-72 truncate">{questionLabel}</span>
                  <SmartFormV2RequiredIndicator
                    required={required}
                    requiredLabel={copy.required}
                    optionalLabel={copy.optional}
                  />
                  <span className="sr-only">
                    {answerTypeLabel(questionType, copy)}
                  </span>
                </span>
              </div>
              {comparisonLabels.map((comparisonLabel, branchIndex) => {
                const BranchSlot = branchSlots[branchIndex];
                if (!BranchSlot) {
                  return null;
                }
                return (
                  <div key={branchIndex}>
                    {branchIndex > 0 ? (
                      <div className="my-2 ml-6 h-px bg-border/60" />
                    ) : null}
                    <div className="smart-form-puck-slot-wrap relative ml-6">
                      <div className="flex flex-wrap items-center gap-2 px-1 py-2 text-xs font-semibold">
                        <span className="text-primary">
                          {branchIndex === 0
                            ? copy.conditionIf
                            : copy.conditionElseIf}
                        </span>
                        <span className="text-muted-foreground">
                          {comparisonLabel}
                        </span>
                        <span className="rounded-md border border-border/70 bg-muted/35 px-1.5 py-0.5 text-foreground">
                          {expectedLabels[branchIndex]}
                        </span>
                      </div>
                      <BranchSlot
                        allow={Object.values(SMART_FORM_PUCK_COMPONENTS)}
                        className="smart-form-puck-slot smart-form-conditional-slot space-y-3 rounded-lg border border-dashed border-border/70 bg-background p-3 transition-colors hover:border-primary/45"
                        minEmptyHeight={72}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="my-2 ml-6 h-px bg-border/60" />
              <div className="smart-form-puck-slot-wrap relative ml-6">
                <div className="px-1 py-2 text-xs font-semibold text-primary">
                  {copy.conditionOtherwise}
                </div>
                <Otherwise
                  allow={Object.values(SMART_FORM_PUCK_COMPONENTS)}
                  className="smart-form-puck-slot smart-form-conditional-slot space-y-3 rounded-lg border border-dashed border-border/70 bg-background p-3 transition-colors hover:border-primary/45"
                  minEmptyHeight={72}
                />
              </div>
            </article>
          );
        },
      },
    },
    root: {
      render: ({ children, puck }) => {
        const documentTitle = String(puck.metadata.documentTitle ?? "");
        const documentDescription = String(
          puck.metadata.documentDescription ?? ""
        );
        const documentTitleReference = String(
          puck.metadata.documentTitleReference ?? ""
        );
        const documentDescriptionReference = String(
          puck.metadata.documentDescriptionReference ?? ""
        );
        const dropIntoDocument = String(
          puck.metadata.dropIntoDocument ?? copy.dropIntoDocument
        );
        return (
          <article className="mx-auto min-h-[900px] w-full max-w-6xl rounded-lg border border-border/70 bg-background shadow-sm">
            <SmartFormDocumentMetadataFields
              description={documentDescription}
              descriptionReference={documentDescriptionReference}
              title={documentTitle}
              titleReference={documentTitleReference}
            />
            <div className="smart-form-puck-root-slot relative px-8 py-6 md:px-12 md:py-8">
              {children}
              <span className="smart-form-puck-root-label pointer-events-none absolute inset-x-8 top-14 text-center text-xs font-medium text-primary">
                {dropIntoDocument}
              </span>
            </div>
          </article>
        );
      },
    },
  };
}

function SmartFormDocumentMetadataFields({
  description,
  descriptionReference,
  title,
  titleReference,
}: {
  description: string;
  descriptionReference: string;
  title: string;
  titleReference: string;
}) {
  const context = useEditorContext();
  return (
    <header className="border-b border-border/70 px-8 py-8 md:px-12 md:py-10">
      <Input
        value={title}
        aria-label={`${context.copy.edit}: ${title || context.copy.sectionTitlePlaceholder}`}
        className="h-auto border-transparent bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight shadow-none hover:border-input focus-visible:border-ring md:text-3xl"
        placeholder={
          titleReference
            ? `${context.copy.chineseReference}: ${titleReference}`
            : context.copy.sectionTitlePlaceholder
        }
        onChange={(event) => context.onDocumentTitleChange(event.target.value)}
      />
      <Textarea
        value={description}
        aria-label={`${context.copy.edit}: ${description || context.copy.staticTextPlaceholder}`}
        placeholder={
          descriptionReference
            ? `${context.copy.chineseReference}: ${descriptionReference}`
            : context.copy.staticTextPlaceholder
        }
        rows={2}
        className="mt-2 min-h-10 resize-none border-transparent bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none hover:border-input focus-visible:border-ring"
        onChange={(event) =>
          context.onDocumentDescriptionChange(event.target.value)
        }
      />
    </header>
  );
}

export function definitionToPuckData(
  definition: SmartFormV2Definition,
  compiledDefinition: SmartFormV2CompiledDefinition | undefined,
  locale: string,
  copy: SmartFormPuckCopy
): SmartFormPuckData {
  return {
    root: {},
    content: definition.children.map((node) =>
      nodeToPuckComponent(
        node,
        compiledDefinition,
        locale,
        definition.i18n.defaultLocale,
        copy
      )
    ) as SmartFormPuckData["content"],
  };
}

export function puckDataToDefinition(
  data: SmartFormPuckData,
  base: SmartFormV2Definition,
  copy: SmartFormPuckCopy
): SmartFormV2Definition {
  const children = data.content.map((component) =>
    puckComponentToNode(
      component as ComponentData<Record<string, unknown>>,
      base.i18n.defaultLocale,
      copy
    )
  );
  return { ...base, children };
}

function nodeToPuckComponent(
  node: SmartFormV2Node,
  compiledDefinition: SmartFormV2CompiledDefinition | undefined,
  locale: string,
  defaultLocale: string,
  copy: SmartFormPuckCopy
): ComponentData<Record<string, unknown>> {
  if (node.kind === "section" || node.kind === "group") {
    const source = { ...node, children: [] };
    return {
      type: SMART_FORM_PUCK_COMPONENTS.section,
      props: {
        id: node.id,
        sourceJson: serializeNode(source),
        title:
          readLocalizedForDesigner(node.title, locale, defaultLocale, copy) ||
          copy.sectionTitlePlaceholder,
        description: readLocalizedForDesigner(
          node.description,
          locale,
          defaultLocale,
          copy
        ),
        content: node.children.map((child) =>
          nodeToPuckComponent(
            child,
            compiledDefinition,
            locale,
            defaultLocale,
            copy
          )
        ),
      },
    };
  }
  if (node.kind === "conditional") {
    const source = {
      ...node,
      branches: node.branches.map((branch) => ({ ...branch, children: [] })),
      otherwise: { ...node.otherwise, children: [] },
    };
    const comparisons = node.branches.map((branch) =>
      conditionComparisonPreview(
        node,
        branch.comparison,
        locale,
        defaultLocale,
        copy
      )
    );
    const branchChildren = node.branches.map((branch) =>
      branch.children.map((child) =>
        nodeToPuckComponent(
          child,
          compiledDefinition,
          locale,
          defaultLocale,
          copy
        )
      )
    );
    return {
      type: SMART_FORM_PUCK_COMPONENTS.conditional,
      props: {
        id: node.id,
        sourceJson: serializeNode(source),
        questionLabel:
          readLocalizedForDesigner(
            node.branchQuestion.label,
            locale,
            defaultLocale,
            copy
          ) || copy.branchQuestionPlaceholder,
        questionType: answerTypeForField(node.branchQuestion.value) as
          | "singleChoice"
          | "multipleChoice"
          | "number",
        required: node.branchQuestion.required,
        comparisonLabels: comparisons.map((comparison) => comparison.label),
        expectedLabels: comparisons.map((comparison) => comparison.expected),
        branch0: branchChildren[0] ?? [],
        branch1: branchChildren[1] ?? [],
        branch2: branchChildren[2] ?? [],
        branch3: branchChildren[3] ?? [],
        branch4: branchChildren[4] ?? [],
        branch5: branchChildren[5] ?? [],
        branch6: branchChildren[6] ?? [],
        branch7: branchChildren[7] ?? [],
        otherwise: node.otherwise.children.map((child) =>
          nodeToPuckComponent(
            child,
            compiledDefinition,
            locale,
            defaultLocale,
            copy
          )
        ),
      },
    };
  }
  if (node.kind === "content") {
    return {
      type: SMART_FORM_PUCK_COMPONENTS.staticText,
      props: {
        id: node.id,
        sourceJson: serializeNode(node),
        text:
          readLocalizedForDesigner(node.content, locale, defaultLocale, copy) ||
          copy.staticTextPlaceholder,
      },
    };
  }
  if (node.kind === "field") {
    return {
      type: SMART_FORM_PUCK_COMPONENTS.question,
      props: {
        id: node.id,
        sourceJson: serializeNode(node),
        label:
          readLocalizedForDesigner(node.label, locale, defaultLocale, copy) ||
          copy.fieldLabelPlaceholder,
        help: readLocalizedForDesigner(node.help, locale, defaultLocale, copy),
        answerType: answerTypeForField(node.value),
        required: Boolean(node.required),
        options:
          node.value.type === "choice"
            ? node.value.options.map((option) =>
                readLocalizedForDesigner(
                  option.label,
                  locale,
                  defaultLocale,
                  copy
                )
              )
            : [],
      },
    };
  }
  const displaySheet =
    node.kind === "sheet"
      ? node
      : findCompiledSheet(compiledDefinition?.children ?? [], node.id);
  return {
    type: SMART_FORM_PUCK_COMPONENTS.table,
    props: {
      id: node.id,
      sourceJson: serializeNode(node),
      title: readLocalizedForDesigner(
        displaySheet?.title,
        locale,
        defaultLocale,
        copy
      ),
      description: readLocalizedForDesigner(
        displaySheet?.description,
        locale,
        defaultLocale,
        copy
      ),
      rowHeader:
        readLocalizedForDesigner(
          flattenSheetColumns(displaySheet?.columns ?? []).find(
            (column) => column.cell.kind === "rowLabel"
          )?.header,
          locale,
          defaultLocale,
          copy
        ) || copy.rowHeader,
      columns: flattenSheetColumns(displaySheet?.columns ?? [])
        .filter((column) => column.cell.kind === "field")
        .map((column) => ({
          id: column.id,
          label:
            readLocalizedForDesigner(
              column.header,
              locale,
              defaultLocale,
              copy
            ) || copy.columnHeader,
          required:
            column.cell.kind === "field" && column.cell.field.required === true,
        })),
      rows:
        displaySheet?.rows.mode === "fixed"
          ? flattenRows(displaySheet.rows.items, locale, defaultLocale, copy)
          : [],
    },
  };
}

function puckComponentToNode(
  component: ComponentData<Record<string, unknown>>,
  locale: string,
  copy: SmartFormPuckCopy
): SmartFormV2Node {
  const { id } = component.props;
  if (component.type === SMART_FORM_PUCK_COMPONENTS.conditional) {
    const source = parseNode(component.props.sourceJson);
    const readSlot = (slot: unknown) =>
      Array.isArray(slot)
        ? (slot as ComponentData<Record<string, unknown>>[]).map((child) =>
            puckComponentToNode(child, locale, copy)
          )
        : [];
    const branchChildren = [
      component.props.branch0,
      component.props.branch1,
      component.props.branch2,
      component.props.branch3,
      component.props.branch4,
      component.props.branch5,
      component.props.branch6,
      component.props.branch7,
    ].map(readSlot);
    const otherwiseChildren = Array.isArray(component.props.otherwise)
      ? (
          component.props.otherwise as ComponentData<Record<string, unknown>>[]
        ).map((child) => puckComponentToNode(child, locale, copy))
      : [];
    if (source?.kind === "conditional") {
      return {
        ...source,
        id,
        branches: source.branches.map((branch, index) => ({
          ...branch,
          children: branchChildren[index] ?? [],
        })),
        otherwise: { ...source.otherwise, children: otherwiseChildren },
      };
    }
    const questionId = `${id}-branch-question`;
    const questionType = String(component.props.questionType);
    const questionLabel = String(
      component.props.questionLabel || copy.branchQuestionPlaceholder
    );
    if (questionType === "number") {
      return {
        kind: "conditional",
        id,
        branchQuestion: {
          kind: "field",
          id: questionId,
          label: localizedText(questionLabel, `${questionId}-label`, locale),
          value: { type: "number", scale: 2 },
          required: Boolean(component.props.required),
        },
        branches: [
          {
            id: `${id}-branch-1`,
            comparison: { type: "number", operator: "gte", value: "0" },
            children: branchChildren[0] ?? [],
          },
        ],
        otherwise: {
          id: `${id}-otherwise`,
          children: otherwiseChildren,
        },
      };
    }
    const cardinality = questionType === "multipleChoice" ? "many" : "one";
    return {
      kind: "conditional",
      id,
      branchQuestion: {
        kind: "field",
        id: questionId,
        label: localizedText(questionLabel, `${questionId}-label`, locale),
        value: {
          type: "choice",
          cardinality,
          options: [
            {
              id: "yes",
              value: "yes",
              label: localizedText(copy.yes, `${questionId}-yes`, locale),
            },
            {
              id: "no",
              value: "no",
              label: localizedText(copy.no, `${questionId}-no`, locale),
            },
          ],
        },
        required: Boolean(component.props.required),
      },
      branches: [
        {
          id: `${id}-branch-1`,
          comparison:
            cardinality === "many"
              ? {
                  type: "multipleChoice",
                  operator: "includesAny",
                  optionIds: ["yes"],
                }
              : {
                  type: "singleChoice",
                  operator: "selected",
                  optionId: "yes",
                },
          children: branchChildren[0] ?? [],
        },
      ],
      otherwise: {
        id: `${id}-otherwise`,
        children: otherwiseChildren,
      },
    };
  }
  if (component.type === SMART_FORM_PUCK_COMPONENTS.section) {
    const source = parseNode(component.props.sourceJson);
    const content = Array.isArray(component.props.content)
      ? (component.props.content as ComponentData<Record<string, unknown>>[])
      : [];
    const children = content.map((child) =>
      puckComponentToNode(child, locale, copy)
    );
    if (source?.kind === "section" || source?.kind === "group") {
      return { ...source, id, children };
    }
    return {
      kind: "section",
      id,
      title: localizedText(
        String(component.props.title || copy.sectionTitlePlaceholder),
        `${id}-title`,
        locale
      ),
      children,
    };
  }
  if (component.type === SMART_FORM_PUCK_COMPONENTS.staticText) {
    const source = parseNode(component.props.sourceJson);
    if (source?.kind === "content") {
      return { ...source, id };
    }
    return {
      kind: "content",
      id,
      content: localizedText(
        String(component.props.text || copy.staticTextPlaceholder),
        `${id}-content`,
        locale
      ),
    };
  }
  if (component.type === SMART_FORM_PUCK_COMPONENTS.question) {
    const source = parseNode(component.props.sourceJson);
    if (source?.kind === "field") {
      return { ...source, id };
    }
    return {
      kind: "field",
      id,
      label: localizedText(
        String(component.props.label || copy.fieldLabelPlaceholder),
        `${id}-label`,
        locale
      ),
      value: { type: "text", multiline: true },
      required: Boolean(component.props.required),
    };
  }
  const source = parseNode(component.props.sourceJson);
  if (source?.kind === "sheet" || source?.kind === "component") {
    return { ...source, id };
  }
  const rowHeaderId = `${id}-row-label`;
  const answerColumnId = `${id}-answer`;
  return {
    kind: "sheet",
    id,
    title: localizedText(
      String(component.props.title || copy.tableTitlePlaceholder),
      `${id}-title`,
      locale
    ),
    presentation: {
      density: "comfortable",
      width: "full",
      stickyHeader: true,
      showGridLines: true,
      stripedRows: true,
      responsive: "scroll",
    },
    columns: [
      {
        kind: "column",
        id: rowHeaderId,
        header: localizedText(copy.rowHeader, `${rowHeaderId}-header`, locale),
        width: "50%",
        cell: { kind: "rowLabel" },
      },
      {
        kind: "column",
        id: answerColumnId,
        header: localizedText(
          copy.columnHeader,
          `${answerColumnId}-header`,
          locale
        ),
        width: "50%",
        cell: {
          kind: "field",
          field: { required: false, value: { type: "text" } },
        },
      },
    ],
    rows: {
      mode: "fixed",
      items: [
        {
          id: `${id}-row-1`,
          role: "data",
          label: localizedText(copy.rowLabel, `${id}-row-1-label`, locale),
        },
      ],
    },
  };
}

function conditionComparisonPreview(
  node: Extract<SmartFormV2Node, { kind: "conditional" }>,
  comparison: Extract<
    SmartFormV2Node,
    { kind: "conditional" }
  >["branches"][number]["comparison"],
  locale: string,
  defaultLocale: string,
  copy: SmartFormPuckCopy
) {
  if (comparison.type === "number") {
    return {
      label: {
        gt: ">",
        gte: "≥",
        eq: "=",
        lte: "≤",
        lt: "<",
      }[comparison.operator],
      expected: comparison.value,
    };
  }
  const { value } = node.branchQuestion;
  const optionIds =
    comparison.type === "singleChoice"
      ? [comparison.optionId]
      : comparison.optionIds;
  const expected =
    value.type === "choice"
      ? optionIds
          .map((optionId) =>
            readLocalizedForDesigner(
              value.options.find((option) => option.id === optionId)?.label,
              locale,
              defaultLocale,
              copy
            )
          )
          .filter(Boolean)
          .join(" / ")
      : "";
  return {
    label:
      comparison.type === "singleChoice"
        ? copy.conditionSelected
        : comparison.operator === "includesAll"
          ? copy.conditionIncludesAll
          : copy.conditionIncludesAny,
    expected,
  };
}

function answerTypeForField(
  value: SmartFormV2FieldDefinition
): SmartFormPuckAnswerType {
  if (value.type === "choice") {
    return value.cardinality === "one" ? "singleChoice" : "multipleChoice";
  }
  return value.type;
}

function answerTypeLabel(
  value: SmartFormPuckAnswerType,
  copy: SmartFormPuckCopy
) {
  return {
    singleChoice: copy.singleChoice,
    multipleChoice: copy.multipleChoice,
    text: copy.text,
    richText: copy.richText,
    number: copy.number,
    reference: copy.reference,
    attachment: copy.attachment,
    date: copy.date,
  }[value];
}

function flattenRows(
  rows: SmartFormV2FixedSheetRow[],
  locale: string,
  defaultLocale: string,
  copy: SmartFormPuckCopy,
  depth = 0
): TableRowPreview[] {
  return rows.flatMap((row) => [
    {
      id: row.id,
      label: readLocalizedForDesigner(row.label, locale, defaultLocale, copy),
      role: row.role ?? (row.children?.length ? "group" : "data"),
      depth,
    },
    ...flattenRows(row.children ?? [], locale, defaultLocale, copy, depth + 1),
  ]);
}

function flattenSheetColumns(
  columns: SmartFormV2SheetNode["columns"]
): SmartFormV2SheetLeafColumn[] {
  return columns.flatMap((column) =>
    column.kind === "column" ? [column] : flattenSheetColumns(column.children)
  );
}

function findCompiledSheet(
  nodes: SmartFormV2CompiledDefinition["children"],
  id: string
): SmartFormV2SheetNode | undefined {
  for (const node of nodes) {
    if (node.id === id && node.kind === "sheet") {
      return node;
    }
    if (node.kind === "section" || node.kind === "group") {
      const match = findCompiledSheet(node.children, id);
      if (match) {
        return match;
      }
    }
    if (node.kind === "conditional") {
      const match = findCompiledSheet(
        [
          ...node.branches.flatMap((branch) => branch.children),
          ...node.otherwise.children,
        ],
        id
      );
      if (match) {
        return match;
      }
    }
  }
  return undefined;
}

function serializeNode(node: SmartFormV2Node) {
  return JSON.stringify(node);
}

function parseNode(value: unknown): SmartFormV2Node | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      typeof parsed.id === "string" &&
      "kind" in parsed &&
      typeof parsed.kind === "string"
    ) {
      return parsed as SmartFormV2Node;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function localizedText(value: string, id: string, locale: string) {
  return {
    values: {
      [locale]: {
        type: "doc" as const,
        version: 1 as const,
        content: [
          {
            type: "paragraph" as const,
            id: `${id}-${locale}`,
            content: value ? [{ type: "text" as const, text: value }] : [],
          },
        ],
      },
    },
  };
}

function updateLocalizedDocumentText(
  current:
    | SmartFormV2Definition["title"]
    | SmartFormV2Definition["description"]
    | undefined,
  value: string,
  locale: string,
  id: string,
  _supportedLocales: string[]
): SmartFormV2Definition["title"] {
  if (!current) {
    return localizedText(value, id, locale);
  }
  const values = { ...current.values };
  const previous = values[locale];
  values[locale] = {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        id: previous?.content[0]?.id ?? `${id}-${locale}`,
        content: value ? [{ type: "text", text: value }] : [],
      },
    ],
  };
  return { values };
}

function updateOptionalLocalizedDocumentText(
  current: SmartFormV2Definition["description"] | undefined,
  value: string,
  locale: string,
  id: string,
  supportedLocales: string[]
): SmartFormV2Definition["description"] {
  if (!current && !value) {
    return undefined;
  }
  if (current && !value) {
    const values = { ...current.values };
    Reflect.deleteProperty(values, locale);
    return Object.keys(values).length > 0 ? { values } : undefined;
  }
  return updateLocalizedDocumentText(
    current,
    value,
    locale,
    id,
    supportedLocales
  );
}

function _unused_readLocalized(
  value:
    | SmartFormV2Definition["title"]
    | SmartFormV2Definition["description"]
    | undefined,
  locale: string
) {
  const document =
    value?.values[locale] ?? Object.values(value?.values ?? {})[0];
  if (!document) {
    return "";
  }
  return document.content
    .map((block) => {
      if (block.type === "paragraph" || block.type === "heading") {
        return block.content
          .map((inline) =>
            inline.type === "text"
              ? inline.text
              : inline.type === "hardBreak"
                ? "\n"
                : ""
          )
          .join("");
      }
      if (block.type === "bulletList" || block.type === "orderedList") {
        return block.items
          .map((item, index) => {
            const prefix =
              block.type === "orderedList" ? `${index + 1}. ` : "• ";
            return `${prefix}${item.content
              .flatMap((child) =>
                child.type === "paragraph"
                  ? child.content.map((inline) =>
                      inline.type === "text" ? inline.text : ""
                    )
                  : []
              )
              .join("")}`;
          })
          .join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function readLocalizedExact(
  value:
    | SmartFormV2Definition["title"]
    | SmartFormV2Definition["description"]
    | undefined,
  locale: string
) {
  const document = value?.values[locale];
  if (!document) {
    return "";
  }
  return richTextDocumentToPlainText(document);
}

function readLocalizedForDesigner(
  value:
    | SmartFormV2Definition["title"]
    | SmartFormV2Definition["description"]
    | undefined,
  locale: string,
  defaultLocale: string,
  copy: SmartFormPuckCopy
) {
  const exact = readLocalizedExact(value, locale);
  if (exact || locale === defaultLocale) {
    return exact;
  }
  const reference = readLocalizedExact(value, defaultLocale);
  return reference ? `${copy.chineseReference}: ${reference}` : "";
}

function richTextDocumentToPlainText(
  document: NonNullable<SmartFormV2Definition["description"]>["values"][string]
) {
  return document.content
    .map((block) => {
      if (block.type === "paragraph" || block.type === "heading") {
        return block.content
          .map((inline) =>
            inline.type === "text"
              ? inline.text
              : inline.type === "hardBreak"
                ? "\n"
                : ""
          )
          .join("");
      }
      if (block.type === "bulletList" || block.type === "orderedList") {
        return block.items
          .map((item, index) => {
            const prefix =
              block.type === "orderedList" ? `${index + 1}. ` : "• ";
            return `${prefix}${item.content
              .flatMap((child) =>
                child.type === "paragraph"
                  ? child.content.map((inline) =>
                      inline.type === "text" ? inline.text : ""
                    )
                  : []
              )
              .join("")}`;
          })
          .join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function useEditorContext() {
  const value = useContext(EditorContext);
  if (!value) {
    throw new Error("SmartForm Puck editor context is missing");
  }
  return value;
}
