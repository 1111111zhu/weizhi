import { z } from "zod";

import { SmartFormV2CompileError } from "./smart-form-v2-compile-error.js";
import type {
  SmartFormV2ComponentInstanceNode,
  SmartFormV2ConditionalArm,
  SmartFormV2ConditionalNode,
  SmartFormV2ConditionalOtherwiseArm,
  SmartFormV2Definition,
  SmartFormV2GroupNode,
  SmartFormV2Node,
  SmartFormV2SectionNode,
} from "./smart-form-v2.js";
import {
  SmartFormV2DefinitionSchema,
  SmartFormV2NodeSchema,
} from "./smart-form-v2.js";

export {
  SmartFormV2CompileError,
  type SmartFormV2CompileErrorCode,
} from "./smart-form-v2-compile-error.js";

export type SmartFormV2CoreSectionNode = Omit<
  SmartFormV2SectionNode,
  "children"
> & {
  children: SmartFormV2CoreNode[];
};

export type SmartFormV2CoreGroupNode = Omit<
  SmartFormV2GroupNode,
  "children"
> & {
  children: SmartFormV2CoreNode[];
};

export type SmartFormV2CoreConditionalNode = Omit<
  SmartFormV2ConditionalNode,
  "branches" | "otherwise"
> & {
  branches: (Omit<SmartFormV2ConditionalArm, "children"> & {
    children: SmartFormV2CoreNode[];
  })[];
  otherwise: Omit<SmartFormV2ConditionalOtherwiseArm, "children"> & {
    children: SmartFormV2CoreNode[];
  };
};

export type SmartFormV2CoreNode =
  | SmartFormV2CoreSectionNode
  | SmartFormV2CoreGroupNode
  | SmartFormV2CoreConditionalNode
  | Exclude<
      SmartFormV2Node,
      | SmartFormV2SectionNode
      | SmartFormV2GroupNode
      | SmartFormV2ConditionalNode
      | SmartFormV2ComponentInstanceNode
    >;

export type SmartFormV2CompiledDefinition = Omit<
  SmartFormV2Definition,
  "children"
> & {
  children: SmartFormV2CoreNode[];
};

export type SmartFormV2ComponentCompileInput<TProps> = {
  instance: SmartFormV2ComponentInstanceNode;
  props: TProps;
  slots: Readonly<Record<string, SmartFormV2CoreNode[]>>;
};

export type SmartFormV2ComponentDefinition = {
  componentId: string;
  componentVersion: number;
  digest: string;
  propsSchema: z.ZodType<unknown>;
  compile: (
    input: SmartFormV2ComponentCompileInput<unknown>
  ) => SmartFormV2Node[];
};

export function defineSmartFormV2Component<TSchema extends z.ZodType>(
  definition: Omit<
    SmartFormV2ComponentDefinition,
    "propsSchema" | "compile"
  > & {
    propsSchema: TSchema;
    compile: (
      input: SmartFormV2ComponentCompileInput<z.output<TSchema>>
    ) => SmartFormV2Node[];
  }
): SmartFormV2ComponentDefinition {
  return {
    componentId: definition.componentId,
    componentVersion: definition.componentVersion,
    digest: definition.digest,
    propsSchema: definition.propsSchema as z.ZodType<unknown>,
    compile: (input) =>
      definition.compile({
        ...input,
        props: input.props as z.output<TSchema>,
      }),
  };
}

export class SmartFormV2ComponentRegistry {
  readonly #definitions = new Map<string, SmartFormV2ComponentDefinition>();

  constructor(definitions: readonly SmartFormV2ComponentDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: SmartFormV2ComponentDefinition) {
    const key = componentKey(
      definition.componentId,
      definition.componentVersion
    );
    if (this.#definitions.has(key)) {
      throw new SmartFormV2CompileError(
        "DUPLICATE_COMPONENT_DEFINITION",
        `Component ${key} is already registered`
      );
    }
    if (!/^[a-f0-9]{64}$/.test(definition.digest)) {
      throw new SmartFormV2CompileError(
        "INVALID_COMPONENT_DEFINITION",
        `Component ${key} must declare a SHA-256 digest`
      );
    }
    this.#definitions.set(key, definition);
    return this;
  }

  resolve(componentId: string, componentVersion: number) {
    return this.#definitions.get(componentKey(componentId, componentVersion));
  }
}

const SMART_FORM_V2_MAX_COMPONENT_EXPANSION_DEPTH = 64;

export function compileSmartFormV2Definition(
  input: unknown,
  registry: SmartFormV2ComponentRegistry
): SmartFormV2CompiledDefinition {
  const authoredResult = SmartFormV2DefinitionSchema.safeParse(input);
  if (!authoredResult.success) {
    throw new SmartFormV2CompileError(
      "INVALID_AUTHORED_DEFINITION",
      "SmartForm V2 authored definition is invalid",
      [],
      authoredResult.error.issues
    );
  }
  const authored = authoredResult.data;
  const locks = new Map(
    (authored.componentLocks ?? []).map((lock) => [
      componentKey(lock.componentId, lock.componentVersion),
      lock,
    ])
  );
  const compileNodes = (
    nodes: readonly SmartFormV2Node[],
    path: readonly (string | number)[],
    expansionStack: readonly string[]
  ): SmartFormV2CoreNode[] =>
    nodes.flatMap((node, nodeIndex) =>
      compileNode(node, [...path, nodeIndex], expansionStack)
    );
  const compileNode = (
    node: SmartFormV2Node,
    path: readonly (string | number)[],
    expansionStack: readonly string[]
  ): SmartFormV2CoreNode[] => {
    if (node.kind === "section" || node.kind === "group") {
      return [
        {
          ...node,
          children: compileNodes(
            node.children,
            [...path, "children"],
            expansionStack
          ),
        },
      ];
    }
    if (node.kind === "conditional") {
      return [
        {
          ...node,
          branches: node.branches.map((branch, branchIndex) => ({
            ...branch,
            children: compileNodes(
              branch.children,
              [...path, "branches", branchIndex, "children"],
              expansionStack
            ),
          })),
          otherwise: {
            ...node.otherwise,
            children: compileNodes(
              node.otherwise.children,
              [...path, "otherwise", "children"],
              expansionStack
            ),
          },
        },
      ];
    }
    if (node.kind !== "component") {
      return [node];
    }

    const key = componentKey(node.componentId, node.componentVersion);
    const definition = registry.resolve(
      node.componentId,
      node.componentVersion
    );
    if (!definition) {
      throw new SmartFormV2CompileError(
        "COMPONENT_NOT_REGISTERED",
        `Component ${key} is not registered`,
        path
      );
    }
    const lock = locks.get(key);
    if (!lock || lock.digest !== definition.digest) {
      throw new SmartFormV2CompileError(
        "COMPONENT_DIGEST_MISMATCH",
        `Component ${key} does not match its immutable version lock`,
        path,
        {
          lockedDigest: lock?.digest,
          registeredDigest: definition.digest,
        }
      );
    }
    if (expansionStack.length >= SMART_FORM_V2_MAX_COMPONENT_EXPANSION_DEPTH) {
      throw new SmartFormV2CompileError(
        "COMPONENT_EXPANSION_DEPTH_EXCEEDED",
        "Component expansion exceeded the maximum depth",
        path,
        expansionStack
      );
    }
    if (expansionStack.includes(key)) {
      throw new SmartFormV2CompileError(
        "COMPONENT_EXPANSION_CYCLE",
        `Component expansion cycle detected at ${key}`,
        path,
        [...expansionStack, key]
      );
    }

    const propsResult = definition.propsSchema.safeParse(node.props);
    if (!propsResult.success) {
      throw new SmartFormV2CompileError(
        "INVALID_COMPONENT_PROPS",
        `Props for component ${key} are invalid`,
        [...path, "props"],
        propsResult.error.issues
      );
    }

    const slots = Object.fromEntries(
      Object.entries(node.slots ?? {}).map(([slotName, slotNodes]) => [
        slotName,
        compileNodes(slotNodes, [...path, "slots", slotName], expansionStack),
      ])
    );

    let output: SmartFormV2Node[];
    try {
      output = definition.compile({
        instance: node,
        props: propsResult.data,
        slots,
      });
    } catch (error) {
      if (error instanceof SmartFormV2CompileError) {
        throw error;
      }
      throw new SmartFormV2CompileError(
        "COMPONENT_COMPILE_FAILED",
        `Component ${key} failed while compiling`,
        path,
        error
      );
    }

    const outputResult = z
      .array(SmartFormV2NodeSchema)
      .min(1)
      .safeParse(output);
    if (!outputResult.success) {
      throw new SmartFormV2CompileError(
        "INVALID_COMPONENT_OUTPUT",
        `Component ${key} produced invalid V2 nodes`,
        path,
        outputResult.error.issues
      );
    }
    return compileNodes(
      outputResult.data,
      [...path, "$componentOutput"],
      [...expansionStack, key]
    );
  };
  const compiledCandidate = {
    ...authored,
    children: compileNodes(authored.children, ["children"], []),
  };
  const compiledResult =
    SmartFormV2DefinitionSchema.safeParse(compiledCandidate);
  if (!compiledResult.success) {
    throw new SmartFormV2CompileError(
      "INVALID_COMPILED_DEFINITION",
      "Compiled SmartForm V2 definition is invalid",
      [],
      compiledResult.error.issues
    );
  }
  if (containsSmartFormV2Component(compiledResult.data.children)) {
    throw new SmartFormV2CompileError(
      "INVALID_COMPILED_DEFINITION",
      "Compiled SmartForm V2 definition still contains component instances"
    );
  }
  return compiledResult.data as SmartFormV2CompiledDefinition;
}

function componentKey(componentId: string, componentVersion: number) {
  return `${componentId}@${componentVersion}`;
}

function containsSmartFormV2Component(
  nodes: readonly SmartFormV2Node[]
): boolean {
  return nodes.some((node) => {
    if (node.kind === "component") {
      return true;
    }
    if (node.kind === "section" || node.kind === "group") {
      return containsSmartFormV2Component(node.children);
    }
    if (node.kind === "conditional") {
      return (
        node.branches.some((branch) =>
          containsSmartFormV2Component(branch.children)
        ) || containsSmartFormV2Component(node.otherwise.children)
      );
    }
    return false;
  });
}
