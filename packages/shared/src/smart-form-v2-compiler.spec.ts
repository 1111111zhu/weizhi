import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { SmartFormV2Node } from "./smart-form-v2";
import { SmartFormV2DefinitionSchema } from "./smart-form-v2";
import {
  SmartFormV2CompileError,
  SmartFormV2ComponentRegistry,
  compileSmartFormV2Definition,
  defineSmartFormV2Component,
} from "./smart-form-v2-compiler";
import {
  AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST,
  AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
  AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
} from "./smart-form-v2-components";
import {
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
} from "./smart-form-v2-fixtures";

describe("smartForm V2 component compiler", () => {
  it("compiles the Deferred Income authored fixture into core nodes only", () => {
    expect(
      containsComponent(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.children)
    ).toBeTruthy();
    expect(
      containsComponent(DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children)
    ).toBeFalsy();
    expect(
      SmartFormV2DefinitionSchema.safeParse(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      ).success
    ).toBeTruthy();
  });

  it("preserves real Deferred Income hierarchy and compiles typed columns", () => {
    const general = firstSection(
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children
    );
    const [sheet] = general.children;
    expect(sheet?.kind).toBe("sheet");
    if (sheet?.kind !== "sheet" || sheet.rows.mode !== "fixed") {
      return;
    }

    expect(sheet.rows.items[1]).toMatchObject({
      id: "deferred-income-procedure-2",
      role: "group",
    });
    expect(sheet.rows.items[1]?.children?.map((row) => row.id)).toStrictEqual([
      "deferred-income-procedure-2-a",
      "deferred-income-procedure-2-b",
    ]);
    expect(sheet.rows.items[3]?.children?.map((row) => row.id)).toStrictEqual([
      "deferred-income-procedure-4-a",
      "deferred-income-procedure-4-b",
    ]);

    expect(
      sheet.columns.map((column) =>
        column.kind === "column" && column.cell.kind === "field"
          ? column.cell.field.value.type
          : "rowLabel"
      )
    ).toStrictEqual(["rowLabel", "choice", "choice", "reference", "richText"]);
    const testRequired = sheet.columns.find(
      (column) => column.kind === "column" && column.id === "test-required"
    );
    expect(
      testRequired?.kind === "column" &&
        testRequired.cell.kind === "field" &&
        testRequired.cell.field.value.type === "choice"
        ? testRequired.cell.field.value.options.map((option) => ({
            id: option.id,
            value: option.value,
          }))
        : []
    ).toStrictEqual([
      { id: "yes", value: "yes" },
      { id: "no", value: "no" },
      { id: "not-applicable", value: "not-applicable" },
    ]);
  });

  it("covers all eleven source-workbook procedures without flattening children", () => {
    const topLevelRowIds: string[] = [];
    const childRowIds: string[] = [];
    for (const section of DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children) {
      if (section.kind !== "section") {
        continue;
      }
      for (const node of section.children) {
        if (node.kind !== "sheet" || node.rows.mode !== "fixed") {
          continue;
        }
        for (const row of node.rows.items) {
          topLevelRowIds.push(row.id);
          childRowIds.push(...(row.children?.map((child) => child.id) ?? []));
        }
      }
    }

    expect(topLevelRowIds).toStrictEqual(
      Array.from(
        { length: 11 },
        (_, index) => `deferred-income-procedure-${index + 1}`
      )
    );
    expect(childRowIds).toStrictEqual([
      "deferred-income-procedure-2-a",
      "deferred-income-procedure-2-b",
      "deferred-income-procedure-4-a",
      "deferred-income-procedure-4-b",
    ]);
  });

  it("preserves conditional branches while compiling components inside them", () => {
    const authored = makeAuthoredDefinition({
      children: [
        {
          kind: "conditional",
          id: "inventory-condition",
          branchQuestion: branchQuestion("inventory-question"),
          branches: [
            {
              id: "inventory-matched-branch",
              comparison: {
                type: "singleChoice",
                operator: "selected",
                optionId: "yes",
              },
              children: [firstAuthoredAuditComponent()],
            },
          ],
          otherwise: {
            id: "inventory-otherwise-branch",
            children: [
              {
                kind: "content",
                id: "inventory-condition-empty-note",
                content: localized(
                  "No inventory procedures apply",
                  "empty-note"
                ),
              },
            ],
          },
        },
      ],
      componentLocks: [auditComponentLock()],
    });

    const compiled = compileSmartFormV2Definition(
      authored,
      STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
    );
    const [conditional] = compiled.children;
    expect(conditional?.kind).toBe("conditional");
    if (conditional?.kind !== "conditional") {
      return;
    }
    expect(conditional.branches[0]?.children[0]?.kind).toBe("sheet");
    expect(conditional.otherwise.children[0]?.kind).toBe("content");
    expect(containsComponent(compiled.children)).toBeFalsy();
  });

  it("rejects incompatible branch comparisons and nesting beyond three levels", () => {
    const incompatible = {
      kind: "conditional" as const,
      id: "incompatible-condition",
      branchQuestion: branchQuestion("incompatible-question"),
      branches: [
        {
          id: "incompatible-branch",
          comparison: {
            type: "number" as const,
            operator: "gt" as const,
            value: "1",
          },
          children: [],
        },
      ],
      otherwise: {
        id: "incompatible-otherwise",
        children: [],
      },
    };
    const conditionalBase = makeAuthoredDefinition({
      children: [
        {
          kind: "content",
          id: "conditional-base-content",
          content: localized("Conditional base", "conditional-base-content"),
        },
      ],
      componentLocks: [],
    });
    expect(
      SmartFormV2DefinitionSchema.safeParse({
        ...conditionalBase,
        children: [incompatible],
      }).success
    ).toBeFalsy();

    const nested = (depth: number): SmartFormV2Node => ({
      kind: "conditional",
      id: `nested-condition-${depth}`,
      branchQuestion: branchQuestion(`nested-question-${depth}`),
      branches: [
        {
          id: `nested-branch-${depth}`,
          comparison: {
            type: "singleChoice",
            operator: "selected",
            optionId: "yes",
          },
          children: depth < 4 ? [nested(depth + 1)] : [],
        },
      ],
      otherwise: {
        id: `nested-otherwise-${depth}`,
        children: [],
      },
    });
    expect(
      SmartFormV2DefinitionSchema.safeParse({
        ...conditionalBase,
        children: [nested(1)],
      }).success
    ).toBeFalsy();
  });

  it("is deterministic and does not mutate the authored fixture", () => {
    const authoredSnapshot = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
    );
    const first = compileSmartFormV2Definition(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
    );
    const second = compileSmartFormV2Definition(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
    );

    expect(first).toStrictEqual(second);
    expect(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE).toStrictEqual(
      authoredSnapshot
    );
  });

  it("rejects unregistered, digest-mismatched, or malformed components", () => {
    expectCompileError(
      () =>
        compileSmartFormV2Definition(
          DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          new SmartFormV2ComponentRegistry()
        ),
      "COMPONENT_NOT_REGISTERED"
    );
    expect(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE).toBeDefined();

    const digestMismatch = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
    );
    assertPresentValue(
      assertPresentValue(digestMismatch.componentLocks)[0]
    ).digest = "b".repeat(64);
    expectCompileError(
      () =>
        compileSmartFormV2Definition(
          digestMismatch,
          STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
        ),
      "COMPONENT_DIGEST_MISMATCH"
    );

    const malformedProps = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
    );
    const general = firstSection(malformedProps.children);
    const [component] = general.children;
    if (component?.kind !== "component") {
      throw new Error("Expected component");
    }
    component.props = { procedures: [] };
    expectCompileError(
      () =>
        compileSmartFormV2Definition(
          malformedProps,
          STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
        ),
      "INVALID_COMPONENT_PROPS"
    );
  });

  it("recursively resolves component instances placed in slots", () => {
    const slotComponent = defineSmartFormV2Component({
      componentId: "slot-container",
      componentVersion: 1,
      digest: "c".repeat(64),
      propsSchema: z.object({}).strict(),
      compile: ({ instance, slots }) => [
        {
          kind: "group",
          id: instance.id,
          children: slots.default ?? [],
        },
      ],
    });
    const registry = new SmartFormV2ComponentRegistry([
      slotComponent,
      ...registeredAuditComponents(),
    ]);
    const auditProps = firstAuthoredAuditComponent().props;
    const authored = makeAuthoredDefinition({
      children: [
        {
          kind: "component",
          id: "slot-root",
          componentId: "slot-container",
          componentVersion: 1,
          props: {},
          slots: {
            default: [
              {
                kind: "component",
                id: "slot-audit-sheet",
                componentId: AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
                componentVersion: AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
                props: auditProps,
              },
            ],
          },
        },
      ],
      componentLocks: [
        {
          componentId: "slot-container",
          componentVersion: 1,
          digest: "c".repeat(64),
        },
        auditComponentLock(),
      ],
    });
    const compiled = compileSmartFormV2Definition(authored, registry);

    expect(containsComponent(compiled.children)).toBeFalsy();
    expect(compiled.children[0]).toMatchObject({
      kind: "group",
      id: "slot-root",
      children: [{ kind: "sheet", id: "slot-audit-sheet" }],
    });
  });

  it("detects generated ID collisions and component expansion cycles", () => {
    const collisionComponent = defineSmartFormV2Component({
      componentId: "collision-component",
      componentVersion: 1,
      digest: "d".repeat(64),
      propsSchema: z.object({}).strict(),
      compile: () => [
        {
          kind: "content",
          id: "collision",
          content: localized("Generated collision", "generated-collision"),
        },
      ],
    });
    const collisionAuthored = makeAuthoredDefinition({
      children: [
        {
          kind: "content",
          id: "collision",
          content: localized("Existing content", "existing-content"),
        },
        {
          kind: "component",
          id: "collision-instance",
          componentId: "collision-component",
          componentVersion: 1,
          props: {},
        },
      ],
      componentLocks: [
        {
          componentId: "collision-component",
          componentVersion: 1,
          digest: "d".repeat(64),
        },
      ],
    });
    expect(collisionAuthored).toBeDefined();
    expectCompileError(
      () =>
        compileSmartFormV2Definition(
          collisionAuthored,
          new SmartFormV2ComponentRegistry([collisionComponent])
        ),
      "INVALID_COMPILED_DEFINITION"
    );

    const componentA = forwardingComponent(
      "cycle-a",
      "e".repeat(64),
      "cycle-b"
    );
    const componentB = forwardingComponent(
      "cycle-b",
      "f".repeat(64),
      "cycle-a"
    );
    const cycleAuthored = makeAuthoredDefinition({
      children: [
        {
          kind: "component",
          id: "cycle-root",
          componentId: "cycle-a",
          componentVersion: 1,
          props: {},
        },
      ],
      componentLocks: [
        {
          componentId: "cycle-a",
          componentVersion: 1,
          digest: "e".repeat(64),
        },
        {
          componentId: "cycle-b",
          componentVersion: 1,
          digest: "f".repeat(64),
        },
      ],
    });
    expectCompileError(
      () =>
        compileSmartFormV2Definition(
          cycleAuthored,
          new SmartFormV2ComponentRegistry([componentA, componentB])
        ),
      "COMPONENT_EXPANSION_CYCLE"
    );
  });
});

function registeredAuditComponents() {
  const definition = STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY.resolve(
    AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
    AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION
  );
  if (!definition) {
    throw new Error("Expected registered audit component");
  }
  return [definition];
}

function firstAuthoredAuditComponent() {
  const general = firstSection(
    DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.children
  );
  const [component] = general.children;
  if (component?.kind !== "component") {
    throw new Error("Expected component");
  }
  return component;
}

function firstSection(children: readonly SmartFormV2Node[]) {
  const section = children.find(
    (node) => node.kind === "section" && node.id === "deferred-income-general"
  );
  if (section?.kind !== "section") {
    throw new Error("Expected section");
  }
  return section;
}

function auditComponentLock() {
  return {
    componentId: AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
    componentVersion: AUDIT_PROCEDURE_SHEET_COMPONENT_VERSION,
    digest: AUDIT_PROCEDURE_SHEET_COMPONENT_DIGEST,
  };
}

function forwardingComponent(
  componentId: string,
  digest: string,
  targetComponentId: string
) {
  return defineSmartFormV2Component({
    componentId,
    componentVersion: 1,
    digest,
    propsSchema: z.object({}).strict(),
    compile: ({ instance }) => [
      {
        kind: "component",
        id: `${instance.id}-${targetComponentId}`,
        componentId: targetComponentId,
        componentVersion: 1,
        props: {},
      },
    ],
  });
}

function makeAuthoredDefinition(input: {
  children: SmartFormV2Node[];
  componentLocks: {
    componentId: string;
    componentVersion: number;
    digest: string;
  }[];
}) {
  return SmartFormV2DefinitionSchema.parse({
    kind: "smartForm",
    schemaVersion: 2,
    id: "compiler-test-definition",
    i18n: {
      defaultLocale: "en-US",
      supportedLocales: ["en-US", "zh-CN"],
      publishingPolicy: "default-required",
    },
    title: localized("Compiler test", "compiler-test-title"),
    children: input.children,
    componentLocks: input.componentLocks,
  });
}

function localized(text: string, id: string) {
  return {
    values: {
      "en-US": {
        type: "doc" as const,
        version: 1 as const,
        content: [
          {
            type: "paragraph" as const,
            id,
            content: [{ type: "text" as const, text }],
          },
        ],
      },
    },
  };
}

function branchQuestion(id: string) {
  return {
    kind: "field" as const,
    id,
    label: localized("Does inventory apply?", `${id}-label`),
    value: {
      type: "choice" as const,
      cardinality: "one" as const,
      options: [
        {
          id: "yes",
          value: "yes",
          label: localized("Yes", `${id}-yes`),
        },
        {
          id: "no",
          value: "no",
          label: localized("No", `${id}-no`),
        },
      ],
    },
    required: true as const,
  };
}

function containsComponent(nodes: readonly SmartFormV2Node[]): boolean {
  return nodes.some((node) => {
    if (node.kind === "component") {
      return true;
    }
    if (node.kind === "section" || node.kind === "group") {
      return containsComponent(node.children);
    }
    if (node.kind === "conditional") {
      return (
        node.branches.some((branch) => containsComponent(branch.children)) ||
        containsComponent(node.otherwise.children)
      );
    }
    return false;
  });
}

function expectCompileError(
  action: () => unknown,
  code: SmartFormV2CompileError["code"]
) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(SmartFormV2CompileError);
  expect((caught as SmartFormV2CompileError).code).toBe(code);
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
