import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import pathModule from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: assertPresentValue(process.env.DATABASE_URL),
  }),
});
const nodeId = "demo-node-wing-2026";
const paperId = "demo-paper-wing-2026";
const pdfId = "demo-attachment-wing-pdf-2026";
const projectId = "demo-project-wing-2026";
const workspaceId = "demo-workspace-wing-2026";
const pdf = createDemoPdf();

function createDemoPdf() {
  const stream = [
    "BT",
    "/F1 24 Tf",
    "72 720 Td",
    "(Project Wing 2026) Tj",
    "0 -36 Td",
    "/F1 13 Tf",
    "(PDF reader acceptance preview.) Tj",
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const header = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n";
  let body = header;
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body, "binary"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "binary");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "binary");
}

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "partner@projectwing.local" },
    update: { name: "Jony Ma", globalRole: "PARTNER" },
    create: {
      email: "partner@projectwing.local",
      name: "Jony Ma",
      globalRole: "PARTNER",
      emailVerified: true,
    },
  });
  const reviewer = await prisma.user.upsert({
    where: { email: "manager@projectwing.local" },
    update: { name: "Project Wing Demo Reviewer", globalRole: "MANAGER" },
    create: {
      email: "manager@projectwing.local",
      name: "Project Wing Demo Reviewer",
      globalRole: "MANAGER",
      emailVerified: true,
    },
  });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  const workspace = await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "Project Wing 2026",
      clientName: "Project Wing Holdings",
      description: "Stable local preview and export demo workspace.",
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "PARTNER" },
          { userId: reviewer.id, role: "REVIEWER" },
        ],
      },
    },
  });
  const project = await prisma.project.create({
    data: {
      id: projectId,
      workspaceId: workspace.id,
      projectCode: "PW-2026-DEMO",
      name: "Project Wing 2026",
      language: "en-US",
      reportingDate: new Date("2027-03-31T00:00:00Z"),
      yearEndDate: new Date("2026-12-31T00:00:00Z"),
      reportDate: new Date("2027-03-31T00:00:00Z"),
      archiveDeadline: new Date("2027-06-30T00:00:00Z"),
      ownerId: owner.id,
      notes: "Stable local demo data. Safe to recreate with db:seed:demo.",
      members: {
        create: [
          {
            userId: owner.id,
            projectRole: "PARTNER",
            inChargeRole: "PARTNER_IN_CHARGE",
          },
          {
            userId: reviewer.id,
            projectRole: "REVIEWER",
            inChargeRole: "MANAGER_IN_CHARGE",
          },
        ],
      },
    },
  });
  await prisma.workflowNode.create({
    data: {
      id: nodeId,
      projectId,
      level: 0,
      code: "A",
      title: "Preview and export verification",
      nodeType: "PHASE",
      sortOrder: 1,
      createdBy: owner.id,
    },
  });
  await prisma.workingPaper.create({
    data: {
      id: paperId,
      projectId,
      workflowNodeId: nodeId,
      code: "A-01",
      title: "PDF and Office preview",
      paperType: "WORKING_PAPER",
      createdBy: owner.id,
      preparerId: owner.id,
      reviewerId: reviewer.id,
    },
  });
  const objectKey = `working-papers/${projectId}/${paperId}/Project Wing 2026 - Audit Canvas.pdf`;
  const uploadRoot =
    process.env.UPLOAD_DIR ?? pathModule.join(process.cwd(), "uploads");
  await mkdir(
    pathModule.join(uploadRoot, `working-papers/${projectId}/${paperId}`),
    {
      recursive: true,
    }
  );
  await writeFile(pathModule.join(uploadRoot, objectKey), pdf);
  await prisma.attachment.create({
    data: {
      id: pdfId,
      projectId,
      workingPaperId: paperId,
      workflowNodeId: nodeId,
      fileKind: "SUPPORTING",
      fileName: "Project Wing 2026 - Audit Canvas.pdf",
      originalName: "Project Wing 2026 - Audit Canvas.pdf",
      fileUrl: objectKey,
      fileSize: pdf.length,
      mimeType: "application/pdf",
      previewStatus: "READY",
      uploadedBy: owner.id,
      lastModifiedBy: owner.id,
    },
  });
  console.log(`Seeded ${project.name} (${project.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
