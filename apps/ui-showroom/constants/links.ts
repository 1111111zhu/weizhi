export const GITHUB = {
  branch: "main",
  org: "fin-agent-lab",
  repo: "ProjectWing",
  user: "fin-agent-lab",
} as const;

const githubUrl = `https://github.com/${GITHUB.org}/${GITHUB.repo}`;

export const LINK = {
  DISCORD: `${githubUrl}/discussions`,
  GITHUB: githubUrl,
  LICENSE: `${githubUrl}/blob/${GITHUB.branch}/LICENSE`,
  PORTFOLIO: githubUrl,
  SHADCN_MCP_DOCS: "https://ui.shadcn.com/docs/mcp",
  SPONSOR: `https://github.com/${GITHUB.user}`,
  X: githubUrl,
  X_SHADCN_LABS: "https://ui.shadcn.com",
} as const;
