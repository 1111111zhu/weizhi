"use client";

import {
  PdfTemplateDesigner,
  PdfTemplateForm,
} from "@project-wing/pdf-template-designer";
import type {
  PdfTemplate,
  PdfTemplateInputs,
} from "@project-wing/pdf-template-designer";
import { Badge, Button, ButtonGroup, Separator } from "@project-wing/ui";
import {
  Bold,
  Italic,
  Minus,
  PanelRight,
  Plus,
  Save,
  Underline,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { useEffect, useMemo, useState } from "react";

const INITIAL_INPUTS: PdfTemplateInputs = [
  {
    bankName: "Harbour Bank Limited",
    clientName: "Orchid Holdings Limited",
    confirmationRef: "AUD-2026-0003-YH-001",
    reportDate: "2026-12-31",
  },
];

const bindingDescriptions = [
  ["clientName", "项目基础信息 · 客户名称"],
  ["bankName", "函证信息库 · 银行名称"],
  ["reportDate", "项目基础信息 · 报告日期"],
  ["confirmationRef", "函证中心 · 函证编号"],
] as const;

type BindingName = (typeof bindingDescriptions)[number][0];
type FieldFormat = {
  bold: boolean;
  fontSize: number;
  italic: boolean;
  underline: boolean;
};

const DEFAULT_FORMAT: FieldFormat = {
  bold: false,
  fontSize: 13,
  italic: false,
  underline: false,
};

const formattingCommands = [
  { icon: Bold, key: "bold", label: "加粗" },
  { icon: Italic, key: "italic", label: "斜体" },
  { icon: Underline, key: "underline", label: "下划线" },
] as const;

const PDF_TEMPLATE_FONT_URLS = {
  LiberationSans: {
    data: "/pdf-template-fonts/LiberationSans-Regular.ttf",
    fallback: true,
  },
  LiberationSansBold: {
    data: "/pdf-template-fonts/LiberationSans-Bold.ttf",
  },
  LiberationSansBoldItalic: {
    data: "/pdf-template-fonts/LiberationSans-BoldItalic.ttf",
  },
  LiberationSansItalic: {
    data: "/pdf-template-fonts/LiberationSans-Italic.ttf",
  },
};

async function loadPdfTemplateFonts() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(PDF_TEMPLATE_FONT_URLS).map(
        async ([name, { data, ...options }]) => [
          name,
          { ...options, data: await (await fetch(data)).arrayBuffer() },
        ]
      )
    )
  );
}

function getFormatFontName(format: FieldFormat) {
  if (format.bold && format.italic) {
    return "LiberationSansBoldItalic";
  }
  if (format.bold) {
    return "LiberationSansBold";
  }
  if (format.italic) {
    return "LiberationSansItalic";
  }
  return "LiberationSans";
}

async function createBankConfirmationBasePdf() {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.16, 0.22);
  const muted = rgb(0.38, 0.44, 0.52);
  const rule = rgb(0.78, 0.81, 0.86);

  page.drawText("BANK CONFIRMATION", {
    color: ink,
    font: bold,
    size: 18,
    x: 188,
    y: 778,
  });
  page.drawText("For audit purposes only", {
    color: muted,
    font: regular,
    size: 9,
    x: 246,
    y: 758,
  });
  page.drawText("To the Manager", {
    color: ink,
    font: regular,
    size: 11,
    x: 70,
    y: 698,
  });
  page.drawText("Client name", {
    color: ink,
    font: bold,
    size: 10,
    x: 70,
    y: 650,
  });
  page.drawText("Bank name", {
    color: ink,
    font: bold,
    size: 10,
    x: 70,
    y: 600,
  });
  page.drawText("Reporting date", {
    color: ink,
    font: bold,
    size: 10,
    x: 70,
    y: 550,
  });
  page.drawText("Reference", {
    color: ink,
    font: bold,
    size: 10,
    x: 70,
    y: 500,
  });
  for (const y of [645, 595, 545, 495]) {
    page.drawLine({
      color: rule,
      end: { x: 520, y },
      start: { x: 185, y },
      thickness: 0.8,
    });
  }
  page.drawText(
    "Please confirm the balances and information relating to the above client as at the reporting date.",
    {
      color: ink,
      font: regular,
      maxWidth: 455,
      size: 10,
      x: 70,
      y: 430,
    }
  );
  page.drawText(
    "The completed confirmation should be returned directly to the auditor.",
    {
      color: muted,
      font: regular,
      size: 9,
      x: 70,
      y: 405,
    }
  );

  return document.saveAsBase64({ dataUri: true });
}

async function createInitialTemplate(): Promise<PdfTemplate> {
  const basePdf = await createBankConfirmationBasePdf();
  return {
    basePdf,
    schemas: [
      [
        {
          content: INITIAL_INPUTS[0]?.clientName ?? "",
          height: 8,
          name: "clientName",
          position: { x: 65, y: 63 },
          required: true,
          type: "text",
          width: 112,
        },
        {
          content: INITIAL_INPUTS[0]?.bankName ?? "",
          height: 8,
          name: "bankName",
          position: { x: 65, y: 81 },
          required: true,
          type: "text",
          width: 112,
        },
        {
          content: INITIAL_INPUTS[0]?.reportDate ?? "",
          height: 8,
          name: "reportDate",
          position: { x: 65, y: 98.5 },
          required: true,
          type: "date",
          width: 54,
        },
        {
          content: INITIAL_INPUTS[0]?.confirmationRef ?? "",
          height: 8,
          name: "confirmationRef",
          position: { x: 65, y: 116 },
          required: true,
          type: "text",
          width: 76,
        },
      ],
    ],
  };
}

export function PdfTemplateDesignerProposal() {
  const [mode, setMode] = useState<"designer" | "form">("designer");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [template, setTemplate] = useState<PdfTemplate | null>(null);
  const [fonts, setFonts] = useState<Awaited<
    ReturnType<typeof loadPdfTemplateFonts>
  > | null>(null);
  const [inputs, setInputs] = useState<PdfTemplateInputs>(INITIAL_INPUTS);
  const [engineMounts, setEngineMounts] = useState(0);
  const [changeCount, setChangeCount] = useState(0);
  const [saveState, setSaveState] = useState<"clean" | "dirty" | "saved">(
    "clean"
  );
  const [activeBinding, setActiveBinding] = useState<BindingName>("clientName");
  const [formats, setFormats] = useState<Record<BindingName, FieldFormat>>(
    () =>
      Object.fromEntries(
        bindingDescriptions.map(([name]) => [name, { ...DEFAULT_FORMAT }])
      ) as Record<BindingName, FieldFormat>
  );

  useEffect(() => {
    let active = true;
    void Promise.all([createInitialTemplate(), loadPdfTemplateFonts()]).then(
      ([nextTemplate, nextFonts]) => {
        if (!active) {
          return;
        }
        setTemplate(nextTemplate);
        setFonts(nextFonts);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const bindingValueCount = useMemo(
    () => Object.values(inputs[0] ?? {}).filter(Boolean).length,
    [inputs]
  );
  const activeFormat = formats[activeBinding];

  const updateActiveFormat = (patch: Partial<FieldFormat>) => {
    const nextFormat = { ...activeFormat, ...patch };
    setFormats((current) => ({ ...current, [activeBinding]: nextFormat }));
    setTemplate((current) =>
      current
        ? {
            ...current,
            schemas: current.schemas.map((page) =>
              page.map((schema) =>
                schema.name === activeBinding
                  ? {
                      ...schema,
                      fontName: getFormatFontName(nextFormat),
                      fontSize: nextFormat.fontSize,
                      underline: nextFormat.underline,
                    }
                  : schema
              )
            ),
          }
        : current
    );
    setChangeCount((current) => current + 1);
  };

  return (
    <section
      aria-label="PDF template designer proposal"
      className="overflow-hidden rounded-xl border bg-background shadow-sm"
      id="pdf-template-designer"
    >
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">银行函证 PDF 模板</h3>
            <Badge variant="warning-outline">Experimental</Badge>
            <Badge variant="outline">pdfme 6.1</Badge>
            <Badge variant="success-outline">设计与填写同源</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            不可变 PDF 底稿 · 单一字段 schema · 无重载填写
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSaveState("saved")}
            size="sm"
            variant="outline"
          >
            <Save />
            保存草稿
          </Button>
          <Button
            accessibleName={inspectorOpen ? "隐藏属性面板" : "显示属性面板"}
            aria-pressed={inspectorOpen}
            onClick={() => setInspectorOpen((current) => !current)}
            size="icon-sm"
            variant={inspectorOpen ? "secondary" : "outline"}
          >
            <PanelRight />
          </Button>
        </div>
      </header>

      <div
        aria-label="模板功能区"
        className="flex min-h-22 flex-wrap items-stretch gap-0 border-b bg-muted/15 px-2 py-1"
        role="toolbar"
      >
        <div className="flex min-w-44 flex-col justify-between border-r px-2 py-1">
          <ButtonGroup aria-label="PDF template mode" className="mt-1">
            <Button
              aria-pressed={mode === "designer"}
              onClick={() => setMode("designer")}
              size="sm"
              variant={mode === "designer" ? "secondary" : "quiet"}
            >
              模板设计
            </Button>
            <Button
              aria-pressed={mode === "form"}
              onClick={() => setMode("form")}
              size="sm"
              variant={mode === "form" ? "secondary" : "quiet"}
            >
              填写预览
            </Button>
          </ButtonGroup>
          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            视图
          </p>
        </div>

        <div className="flex min-w-80 flex-1 flex-col justify-between border-r px-3 py-1">
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {bindingDescriptions.map(([name]) => (
              <Button
                aria-pressed={activeBinding === name}
                key={name}
                onClick={() => setActiveBinding(name)}
                size="xs"
                variant={activeBinding === name ? "secondary" : "quiet"}
              >
                {name}
              </Button>
            ))}
          </div>
          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            当前字段
          </p>
        </div>

        <div className="flex min-w-64 flex-col justify-between border-r px-3 py-1">
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Button
              accessibleName="减小字号"
              onClick={() =>
                updateActiveFormat({
                  fontSize: Math.max(8, activeFormat.fontSize - 1),
                })
              }
              size="icon-xs"
              variant="quiet"
            >
              <Minus />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums">
              {activeFormat.fontSize} pt
            </span>
            <Button
              accessibleName="增大字号"
              onClick={() =>
                updateActiveFormat({
                  fontSize: Math.min(36, activeFormat.fontSize + 1),
                })
              }
              size="icon-xs"
              variant="quiet"
            >
              <Plus />
            </Button>
            <Separator className="mx-1 h-6" orientation="vertical" />
            {formattingCommands.map(({ icon: Icon, key, label }) => (
              <Button
                accessibleName={label}
                aria-pressed={activeFormat[key]}
                key={key}
                onClick={() =>
                  updateActiveFormat({
                    [key]: !activeFormat[key],
                  })
                }
                size="icon-xs"
                variant={activeFormat[key] ? "secondary" : "quiet"}
              >
                <Icon />
              </Button>
            ))}
          </div>
          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            文字格式
          </p>
        </div>

        <div className="flex min-w-28 flex-col justify-between px-2 py-1">
          <Button
            aria-pressed={inspectorOpen}
            className="mt-1"
            onClick={() => setInspectorOpen((current) => !current)}
            size="sm"
            variant={inspectorOpen ? "secondary" : "quiet"}
          >
            <PanelRight />
            属性
          </Button>
          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            面板
          </p>
        </div>
      </div>

      <div
        className={`grid min-h-0 ${
          inspectorOpen
            ? "grid-cols-[minmax(0,1fr)_18rem] max-xl:grid-cols-1"
            : "grid-cols-1"
        }`}
      >
        <div className="min-w-0 bg-muted/20 p-3">
          <div className="h-[760px] min-h-0 overflow-hidden rounded-lg border bg-background shadow-xs max-lg:h-[680px]">
            {template && fonts ? (
              mode === "designer" ? (
                <PdfTemplateDesigner
                  initialTemplate={template}
                  onReady={() => setEngineMounts((current) => current + 1)}
                  onSave={(nextTemplate) => {
                    setTemplate(nextTemplate);
                    setSaveState("saved");
                  }}
                  onTemplateChange={(nextTemplate) => {
                    setTemplate(nextTemplate);
                    setChangeCount((current) => current + 1);
                    setSaveState("dirty");
                  }}
                  template={template}
                />
              ) : (
                <PdfTemplateForm
                  fonts={fonts}
                  inputs={inputs}
                  onInputChange={({ index, name, value }) => {
                    setInputs((current) => {
                      const next = current.map((item) => ({ ...item }));
                      next[index] = { ...next[index], [name]: value };
                      return next;
                    });
                    setChangeCount((current) => current + 1);
                  }}
                  onReady={() => setEngineMounts((current) => current + 1)}
                  template={template}
                />
              )
            ) : (
              <div
                aria-busy="true"
                className="grid h-full place-items-center text-sm text-muted-foreground"
              >
                正在生成真实 PDF 底稿…
              </div>
            )}
          </div>
        </div>

        {inspectorOpen ? (
          <aside
            aria-label="模板属性面板"
            className="grid content-start gap-5 border-l bg-background p-4 max-xl:border-t max-xl:border-l-0"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">验证指标</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/20 p-3">
                  <p
                    className="text-2xl font-semibold tabular-nums"
                    data-testid="pdf-engine-mount-count"
                  >
                    {engineMounts}
                  </p>
                  <p className="text-xs text-muted-foreground">底稿挂载次数</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p
                    className="text-2xl font-semibold tabular-nums"
                    data-testid="pdf-field-change-count"
                  >
                    {changeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">字段变更次数</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                在“填写测试”中连续输入时，字段变更次数应增加，底稿挂载次数应保持不变。
              </p>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  业务绑定
                </p>
                <Badge variant="success-outline">
                  {bindingValueCount}/{bindingDescriptions.length}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {bindingDescriptions.map(([name, description]) => (
                  <div className="rounded-md border p-2.5" key={name}>
                    <code className="text-xs font-semibold text-foreground">
                      {name}
                    </code>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">模板状态</span>
              <Badge
                variant={
                  saveState === "dirty"
                    ? "warning-outline"
                    : saveState === "saved"
                      ? "success-outline"
                      : "outline"
                }
              >
                {saveState === "dirty"
                  ? "有未保存变更"
                  : saveState === "saved"
                    ? "已保存到适配层"
                    : "未修改"}
              </Badge>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
