"use client";

import { useEffect } from "react";

import { ROUTES, withShowroomBasePath } from "@/constants/routes";
import { SITE } from "@/constants/site";

type ToolExecute = (
  input: unknown,
  options: { signal: AbortSignal }
) => Promise<unknown>;

interface ModelContextApi {
  registerTool?: (
    def: {
      description: string;
      execute: ToolExecute;
      inputSchema: Record<string, unknown>;
      name: string;
    },
    options?: { signal: AbortSignal }
  ) => (() => void) | undefined;
}

const getPath = (input: unknown, fallback: string): string => {
  if (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    typeof (input as { path: unknown }).path === "string"
  ) {
    return (input as { path: string }).path;
  }

  return fallback;
};

export const normalizeDocsToolPath = (input: unknown): string => {
  const candidate = getPath(input, ROUTES.DOCS);
  try {
    const url = new URL(candidate, "https://showroom.invalid");
    const isLocal = url.origin === "https://showroom.invalid";
    const isDocs =
      url.pathname === ROUTES.DOCS ||
      url.pathname.startsWith(`${ROUTES.DOCS}/`);
    return isLocal && isDocs
      ? `${url.pathname}${url.search}${url.hash}`
      : ROUTES.DOCS;
  } catch {
    return ROUTES.DOCS;
  }
};

type ToolDefinition = {
  description: string;
  execute: ToolExecute;
  inputSchema: Record<string, unknown>;
  name: string;
};

type RegisterTool = (definition: ToolDefinition) => void;

const registerOpenDocsTool = (register: RegisterTool) => {
  register({
    description: `Navigate this tab to a ${SITE.NAME} documentation path (e.g. /docs/installation).`,
    execute: (input) => {
      const path = normalizeDocsToolPath(input);
      window.location.assign(withShowroomBasePath(path));
      return Promise.resolve({ ok: true, path });
    },
    inputSchema: {
      properties: {
        path: {
          description: "Path beginning with /docs",
          type: "string",
        },
      },
      type: "object",
    },
    name: `${SITE.NAME}_open_docs`,
  });
};

const registerRegistryTool = (register: RegisterTool) => {
  register({
    description:
      "Fetch the published shadcn registry manifest (registry.json) for this site.",
    execute: async (_input, { signal }) => {
      const res = await fetch(
        `${window.location.origin}${withShowroomBasePath(ROUTES.REGISTRY)}`,
        { signal }
      );
      if (!res.ok) {
        return { ok: false, status: res.status };
      }
      return res.json();
    },
    inputSchema: { properties: {}, type: "object" },
    name: `${SITE.NAME}_fetch_registry`,
  });
};

const registerLlmsTool = (register: RegisterTool) => {
  register({
    description: "Open the llms.txt documentation index for this site.",
    execute: () => {
      window.location.assign(withShowroomBasePath(ROUTES.LLMS));
      return Promise.resolve({ ok: true, path: ROUTES.LLMS });
    },
    inputSchema: { properties: {}, type: "object" },
    name: `${SITE.NAME}_open_llms_index`,
  });
};

const setupWebMcpTools = () => {
  const { modelContext } = navigator as Navigator & {
    modelContext?: ModelContextApi;
  };
  const registerTool = modelContext?.registerTool;
  if (typeof registerTool !== "function") {
    return;
  }

  const ac = new AbortController();
  const cleanups: (() => void)[] = [];
  const register: RegisterTool = (definition) => {
    const maybeCleanup = registerTool(definition, { signal: ac.signal });
    if (typeof maybeCleanup === "function") {
      cleanups.push(maybeCleanup);
    }
  };

  registerOpenDocsTool(register);
  registerRegistryTool(register);
  registerLlmsTool(register);

  return () => {
    ac.abort();
    for (const fn of cleanups) {
      fn();
    }
  };
};

export const WebMcpTools = () => {
  useEffect(setupWebMcpTools, []);
  return null;
};
