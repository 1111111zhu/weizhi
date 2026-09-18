import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const demoDatabaseName = "projectwing_demo";
export const demoDatabaseUrl = `postgresql://projectwing:projectwing@localhost:5432/${demoDatabaseName}?schema=public`;
export const demoUploadDir = `${repoRoot}/.local/projectwing-demo/uploads`;
export const demoAuthSecret = "project-wing-local-demo-auth-secret-2026";
