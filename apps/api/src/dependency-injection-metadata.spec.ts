import "reflect-metadata";

import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module";

type NestModuleReference = {
  forwardRef?: () => unknown;
  module?: Function;
};

function unwrapModule(reference: unknown): Function | null {
  if (typeof reference === "function") {
    return reference;
  }
  if (!reference || typeof reference !== "object") {
    return null;
  }
  const moduleReference = reference as NestModuleReference;
  if (typeof moduleReference.module === "function") {
    return moduleReference.module;
  }
  if (typeof moduleReference.forwardRef === "function") {
    return unwrapModule(moduleReference.forwardRef());
  }
  return null;
}

function providerClass(provider: unknown): Function | null {
  if (typeof provider === "function") {
    return provider;
  }
  if (!provider || typeof provider !== "object") {
    return null;
  }
  const definition = provider as { useClass?: unknown };
  return typeof definition.useClass === "function" ? definition.useClass : null;
}

function collectInvalidDependencies(rootModule: Function): string[] {
  const invalid: string[] = [];
  const visited = new Set<Function>();
  const pending: Function[] = [rootModule];

  while (pending.length > 0) {
    const currentModule = pending.pop();
    if (!currentModule || visited.has(currentModule)) {
      continue;
    }
    visited.add(currentModule);

    const imports =
      (Reflect.getMetadata(MODULE_METADATA.IMPORTS, currentModule) as
        | unknown[]
        | undefined) ?? [];
    for (const importedModule of imports) {
      const resolved = unwrapModule(importedModule);
      if (resolved) {
        pending.push(resolved);
      }
    }

    const providers =
      (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, currentModule) as
        | unknown[]
        | undefined) ?? [];
    const controllers =
      (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, currentModule) as
        | unknown[]
        | undefined) ?? [];
    for (const candidate of [...providers, ...controllers]) {
      const target = providerClass(candidate);
      if (!target) {
        continue;
      }
      const parameterTypes =
        (Reflect.getMetadata("design:paramtypes", target) as
          | unknown[]
          | undefined) ?? [];
      parameterTypes.forEach((parameterType, index) => {
        if (parameterType === Function) {
          invalid.push(`${target.name || "Anonymous"}[${index}]`);
        }
      });
    }
  }

  return invalid.sort();
}

describe("Nest dependency injection metadata", () => {
  it("retains runtime classes for constructor-injected dependencies", () => {
    expect(collectInvalidDependencies(AppModule)).toEqual([]);
  });
});
