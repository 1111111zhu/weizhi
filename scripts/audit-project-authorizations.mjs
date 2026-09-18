import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Explicit read-only audit. Never loads .env implicitly or performs repairs.
if (!process.argv.includes("--read-only")) {
  throw new Error(
    "Pass --read-only; this command never modifies authorization data."
  );
}
const variable =
  process.argv
    .find((arg) => arg.startsWith("--connection-env="))
    ?.split("=")[1] ?? "DATABASE_URL";
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) {
  throw new Error("Invalid connection environment variable name.");
}
const connectionString = process.env[variable];
if (!connectionString) {
  throw new Error(
    `Set ${variable} in the process environment; connection details are never printed.`
  );
}
const root = path.resolve(import.meta.dirname, "..");
const requireApi = createRequire(path.join(root, "apps/api/package.json"));
const { PrismaClient } = requireApi("@prisma/client");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { isProjectPermissionSubjectConsistent } = await import(
  pathToFileURL(requireApi.resolve("@project-wing/shared")).href
);
let prisma;
try {
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const report = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '15000ms'`;
      const columns =
        await tx.$queryRaw`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'project_members' AND column_name = 'authorization_suspended_at'`;
      const suspended = columns.length
        ? await tx.$queryRaw`SELECT id FROM project_members WHERE authorization_suspended_at IS NOT NULL`
        : [];
      const suspendedIds = new Set(suspended.map((row) => row.id));
      const rows =
        await tx.$queryRaw`SELECT pm.id, pm.project_id AS "projectId", pm.user_id AS "userId", pm.project_role AS "projectRole", pm.in_charge_role AS "inChargeRole", u.global_role AS "globalRole", u.status AS "userStatus", p.project_code AS "projectCode", p.status AS "projectStatus" FROM project_members pm JOIN users u ON u.id = pm.user_id JOIN projects p ON p.id = pm.project_id WHERE pm.status = 'ACTIVE' ORDER BY pm.project_id, pm.id`;
      const conflicts = rows.filter(
        (row) =>
          row.userStatus !== "ACTIVE" ||
          !isProjectPermissionSubjectConsistent({
            ...row,
            authorizationSuspended: suspendedIds.has(row.id),
          })
      );
      return {
        migrationPresent: columns.length > 0,
        activeMemberships: rows.length,
        conflictCount: conflicts.length,
        conflicts,
      };
    },
    { timeout: 20_000 }
  );
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(
    "Read-only authorization audit failed; check connectivity, schema and database read permissions. No repairs were attempted."
  );
  process.exitCode = 1;
} finally {
  try {
    await prisma?.$disconnect();
  } catch {
    process.exitCode = 1;
  }
}
