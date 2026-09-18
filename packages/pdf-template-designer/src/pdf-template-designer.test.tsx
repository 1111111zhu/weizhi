// @vitest-environment happy-dom

import type { Template } from "@pdfme/common";
import { act } from "react";
import { createRoot } from "react-dom/client";

type MockDesignerInstance = {
  changeCallback?: (template: Template) => void;
  destroyed: boolean;
  props: unknown;
  saveCallback?: (template: Template) => void;
  updateTemplateCalls: Template[];
};

type MockFormInstance = {
  changeCallback?: (input: {
    index: number;
    name: string;
    value: string;
  }) => void;
  destroyed: boolean;
  props: unknown;
  setInputsCalls: Record<string, string>[][];
  updateTemplateCalls: Template[];
};

const engineMocks = vi.hoisted(() => {
  const designers: MockDesignerInstance[] = [];
  const forms: MockFormInstance[] = [];

  class Designer {
    changeCallback?: MockDesignerInstance["changeCallback"];
    destroyed = false;
    props: unknown;
    saveCallback?: MockDesignerInstance["saveCallback"];
    updateTemplateCalls: Template[] = [];

    constructor(props: unknown) {
      this.props = props;
      designers.push(this);
    }

    destroy() {
      this.destroyed = true;
    }

    onChangeTemplate(
      callback: NonNullable<MockDesignerInstance["changeCallback"]>
    ) {
      this.changeCallback = callback;
    }

    onSaveTemplate(
      callback: NonNullable<MockDesignerInstance["saveCallback"]>
    ) {
      this.saveCallback = callback;
    }

    updateTemplate(template: Template) {
      this.updateTemplateCalls.push(template);
    }
  }

  class Form {
    changeCallback?: MockFormInstance["changeCallback"];
    destroyed = false;
    props: unknown;
    setInputsCalls: Record<string, string>[][] = [];
    updateTemplateCalls: Template[] = [];

    constructor(props: unknown) {
      this.props = props;
      forms.push(this);
    }

    destroy() {
      this.destroyed = true;
    }

    onChangeInput(callback: NonNullable<MockFormInstance["changeCallback"]>) {
      this.changeCallback = callback;
    }

    setInputs(inputs: Record<string, string>[]) {
      this.setInputsCalls.push(inputs);
    }

    updateTemplate(template: Template) {
      this.updateTemplateCalls.push(template);
    }
  }

  return { Designer, Form, designers, forms };
});

vi.mock("@pdfme/ui", () => ({
  Designer: engineMocks.Designer,
  Form: engineMocks.Form,
}));

import { PdfTemplateDesigner, PdfTemplateForm } from "./pdf-template-designer";

const template: Template = {
  basePdf: { height: 297, padding: [0, 0, 0, 0], width: 210 },
  schemas: [[]],
};

describe("pdf template designer adapter", () => {
  beforeEach(() => {
    engineMocks.designers.length = 0;
    engineMocks.forms.length = 0;
    document.body.replaceChildren();
  });

  it("keeps pdfme behind the designer contract and forwards semantic events", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onReady = vi.fn();
    const onSave = vi.fn();
    const onTemplateChange = vi.fn();

    await act(async () => {
      root.render(
        <PdfTemplateDesigner
          initialTemplate={template}
          onReady={onReady}
          onSave={onSave}
          onTemplateChange={onTemplateChange}
        />
      );
    });

    const designer = engineMocks.designers[0];
    expect(designer).toBeDefined();
    expect(designer?.props).toMatchObject({
      options: { lang: "zh", sidebarOpen: false },
      template,
    });
    expect(onReady).toHaveBeenCalledOnce();

    await act(async () => {
      designer?.changeCallback?.(template);
      designer?.saveCallback?.(template);
    });
    expect(onTemplateChange).toHaveBeenCalledWith(template);
    expect(onSave).toHaveBeenCalledWith(template);

    const updatedTemplate: Template = {
      ...template,
      schemas: [
        [
          {
            height: 10,
            name: "clientName",
            position: { x: 10, y: 10 },
            type: "text",
            width: 40,
          },
        ],
      ],
    };
    await act(async () => {
      root.render(
        <PdfTemplateDesigner
          initialTemplate={template}
          onReady={onReady}
          onSave={onSave}
          onTemplateChange={onTemplateChange}
          template={updatedTemplate}
        />
      );
    });
    expect(engineMocks.designers).toHaveLength(1);
    expect(designer?.updateTemplateCalls).toStrictEqual([updatedTemplate]);

    await act(async () => root.unmount());
    expect(designer?.destroyed).toBeTruthy();
  });

  it("forwards form values without recreating the PDF engine", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onInputChange = vi.fn();
    const initialInputs = [{ clientName: "Orchid Holdings" }];

    await act(async () => {
      root.render(
        <PdfTemplateForm
          inputs={initialInputs}
          onInputChange={onInputChange}
          template={template}
        />
      );
    });

    const form = engineMocks.forms[0];
    expect(form?.props).toMatchObject({
      inputs: initialInputs,
      options: { lang: "zh", zoomLevel: 1.75 },
      template,
    });

    await act(async () => {
      form?.changeCallback?.({
        index: 0,
        name: "clientName",
        value: "Updated Client",
      });
    });
    expect(onInputChange).toHaveBeenCalledWith({
      index: 0,
      name: "clientName",
      value: "Updated Client",
    });
    expect(engineMocks.forms).toHaveLength(1);

    await act(async () => root.unmount());
    expect(form?.destroyed).toBeTruthy();
  });
});
