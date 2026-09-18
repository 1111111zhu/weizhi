import { createHash } from "node:crypto";

import { LINK } from "@/constants/links";
import { ROUTES, withShowroomBasePath } from "@/constants/routes";
import { SITE } from "@/constants/site";

export const SITE_AGENT_SKILL_MD = `# ${SITE.NAME}

## Summary

Help users inspect Project Wing's code-derived component provenance, review evidence, and install the explicitly published shadcn-compatible registry items.

## Registry

- Registry JSON: \`${withShowroomBasePath(ROUTES.REGISTRY)}\`
- Docs: ${withShowroomBasePath(ROUTES.DOCS)}

## MCP

This site is a shadcn-compatible registry. For MCP workflows, use the maintained shadcn MCP server documentation: ${LINK.SHADCN_MCP_DOCS}

## Install

\`\`\`bash
npx shadcn@latest add ${SITE.URL}/r/button.json
\`\`\`

Prefer following the on-site installation guide: ${withShowroomBasePath(ROUTES.DOCS_INSTALLATION)}
`;

export const siteAgentSkillDigest = (): string => {
  const hex = createHash("sha256")
    .update(SITE_AGENT_SKILL_MD, "utf-8")
    .digest("hex");

  return `sha256:${hex}`;
};
