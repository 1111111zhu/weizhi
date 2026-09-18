"use client";

import type { Template } from "@pdfme/common";
import { date, select, text } from "@pdfme/schemas";
import { Designer, Form } from "@pdfme/ui";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const PDF_TEMPLATE_PLUGINS = {
  Date: date,
  Select: select,
  Text: text,
};

export type PdfTemplate = Template;
export type PdfTemplateInputs = Record<string, string>[];
export type PdfTemplateFontMap = Record<
  string,
  {
    data: string | ArrayBuffer | Uint8Array<ArrayBuffer>;
    fallback?: boolean;
    subset?: boolean;
  }
>;

type EngineState = "loading" | "ready" | "error";

type PdfTemplateEngineFrameProps = {
  children: ReactNode;
  label: string;
  state: EngineState;
};

function PdfTemplateEngineFrame({
  children,
  label,
  state,
}: PdfTemplateEngineFrameProps) {
  return (
    <div
      aria-busy={state === "loading"}
      aria-label={label}
      className="pw-pdf-template-engine"
      data-engine-state={state}
      role="region"
    >
      {children}
      {state === "loading" ? (
        <div className="pw-pdf-template-engine__status" role="status">
          正在加载 PDF 模板引擎…
        </div>
      ) : null}
      {state === "error" ? (
        <div className="pw-pdf-template-engine__status" role="alert">
          PDF 模板引擎加载失败。
        </div>
      ) : null}
    </div>
  );
}

export type PdfTemplateDesignerProps = {
  initialTemplate: PdfTemplate;
  label?: string;
  language?: "en" | "zh";
  onReady?: () => void;
  onSave?: (template: PdfTemplate) => void;
  onTemplateChange?: (template: PdfTemplate) => void;
  template?: PdfTemplate;
};

export function PdfTemplateDesigner({
  initialTemplate,
  label = "PDF 模板设计器",
  language = "zh",
  onReady,
  onSave,
  onTemplateChange,
  template,
}: PdfTemplateDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<Designer | null>(null);
  const initialTemplateRef = useRef(initialTemplate);
  const lastEmittedTemplateRef = useRef<PdfTemplate | null>(null);
  const onSaveRef = useRef(onSave);
  const onReadyRef = useRef(onReady);
  const onTemplateChangeRef = useRef(onTemplateChange);
  const [state, setState] = useState<EngineState>("loading");

  onSaveRef.current = onSave;
  onReadyRef.current = onReady;
  onTemplateChangeRef.current = onTemplateChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    try {
      const designer = new Designer({
        domContainer: container,
        options: { lang: language, sidebarOpen: false },
        plugins: PDF_TEMPLATE_PLUGINS,
        template: initialTemplateRef.current,
      });
      designerRef.current = designer;
      designer.onChangeTemplate((template) => {
        lastEmittedTemplateRef.current = template;
        onTemplateChangeRef.current?.(template);
      });
      designer.onSaveTemplate((template) => {
        onSaveRef.current?.(template);
      });
      setState("ready");
      onReadyRef.current?.();
      return () => {
        designerRef.current = null;
        designer.destroy();
      };
    } catch {
      setState("error");
    }
  }, [language]);

  useEffect(() => {
    if (!template || template === lastEmittedTemplateRef.current) {
      return;
    }
    designerRef.current?.updateTemplate(template);
  }, [template]);

  return (
    <PdfTemplateEngineFrame label={label} state={state}>
      <div className="pw-pdf-template-engine__mount" ref={containerRef} />
    </PdfTemplateEngineFrame>
  );
}

export type PdfTemplateFormProps = {
  inputs: PdfTemplateInputs;
  fonts?: PdfTemplateFontMap;
  label?: string;
  language?: "en" | "zh";
  onReady?: () => void;
  onInputChange?: (input: {
    index: number;
    name: string;
    value: string;
  }) => void;
  template: PdfTemplate;
};

export function PdfTemplateForm({
  inputs,
  fonts,
  label = "PDF 模板填写预览",
  language = "zh",
  onReady,
  onInputChange,
  template,
}: PdfTemplateFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<Form | null>(null);
  const fontsRef = useRef(fonts);
  const initialInputsRef = useRef(inputs);
  const inputsRef = useRef(inputs);
  const onInputChangeRef = useRef(onInputChange);
  const onReadyRef = useRef(onReady);
  const templateRef = useRef(template);
  const [state, setState] = useState<EngineState>("loading");

  onInputChangeRef.current = onInputChange;
  onReadyRef.current = onReady;
  inputsRef.current = inputs;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    try {
      const form = new Form({
        domContainer: container,
        inputs: initialInputsRef.current,
        options: { font: fontsRef.current, lang: language, zoomLevel: 1.75 },
        plugins: PDF_TEMPLATE_PLUGINS,
        template: templateRef.current,
      });
      formRef.current = form;
      form.onChangeInput((input) => {
        onInputChangeRef.current?.(input);
      });
      setState("ready");
      onReadyRef.current?.();
      return () => {
        formRef.current = null;
        form.destroy();
      };
    } catch {
      setState("error");
    }
  }, [language]);

  useEffect(() => {
    formRef.current?.updateTemplate(template);
    formRef.current?.setInputs(inputsRef.current);
  }, [template]);

  useEffect(() => {
    formRef.current?.setInputs(inputs);
  }, [inputs]);

  return (
    <PdfTemplateEngineFrame label={label} state={state}>
      <div className="pw-pdf-template-engine__mount" ref={containerRef} />
    </PdfTemplateEngineFrame>
  );
}
