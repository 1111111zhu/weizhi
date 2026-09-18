import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const clients = await prisma.cmpClient.findMany({
    include: {
      group: true,
      addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
      relationshipsFrom: {
        where: { effectiveTo: null },
        include: { fromClient: true, toClient: true },
      },
      relationshipsTo: {
        where: { effectiveTo: null },
        include: { fromClient: true, toClient: true },
      },
    },
  });
  let created = 0;
  for (const client of clients) {
    const existing = await prisma.cmpClientVersion.findFirst({
      where: { clientId: client.id },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    const creator = client.createdById
      ? await prisma.user.findUnique({
          where: { id: client.createdById },
          select: { name: true },
        })
      : null;
    try {
      await prisma.cmpClientVersion.create({
        data: {
          clientId: client.id,
          versionNumber: 1,
          sourceType: "BASELINE",
          snapshotJson: normalizeSnapshot(client),
          changedById: client.createdById,
          changedByName: creator?.name ?? "System migration",
          approvedAt: client.updatedAt,
        },
      });
      created += 1;
    } catch (error) {
      // Another replica can complete the same idempotent backfill first.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  console.log(`Created ${created} CMP Client baseline versions.`);
}

type CmpClientRelationship = Prisma.CmpClientRelationshipGetPayload<{
  include: { fromClient: true; toClient: true };
}>;
type CmpClientRecord = Awaited<
  ReturnType<typeof prisma.cmpClient.findMany>
>[number] & {
  relationshipsFrom: CmpClientRelationship[];
  relationshipsTo: CmpClientRelationship[];
};

function normalizeSnapshot(client: CmpClientRecord) {
  const serializedClient = JSON.stringify(client);
  const snapshot = JSON.parse(serializedClient) as Record<string, unknown>;
  const relationships = [
    ...client.relationshipsFrom,
    ...client.relationshipsTo,
  ];
  snapshot.relationships = [
    ...new Map(
      relationships.map((relationship) => [relationship.id, relationship])
    ).values(),
  ].map((relationship) => ({
    id: relationship.id,
    groupId: relationship.groupId,
    fromClientId: relationship.fromClientId,
    toClientId: relationship.toClientId,
    type: relationship.type,
    ownershipPercentage: relationship.ownershipPercentage?.toNumber() ?? null,
    effectiveFrom: relationship.effectiveFrom?.toISOString() ?? null,
    effectiveTo: relationship.effectiveTo?.toISOString() ?? null,
    remarks: relationship.remarks,
    approvedViaRequestId: relationship.approvedViaRequestId,
    fromClient: {
      id: relationship.fromClient.id,
      clientCode: relationship.fromClient.clientCode,
      nameZh: relationship.fromClient.nameZh,
      nameEn: relationship.fromClient.nameEn,
      groupId: relationship.fromClient.groupId,
      status: relationship.fromClient.status,
    },
    toClient: {
      id: relationship.toClient.id,
      clientCode: relationship.toClient.clientCode,
      nameZh: relationship.toClient.nameZh,
      nameEn: relationship.toClient.nameEn,
      groupId: relationship.toClient.groupId,
      status: relationship.toClient.status,
    },
    createdAt: relationship.createdAt.toISOString(),
    updatedAt: relationship.updatedAt.toISOString(),
  }));
  delete snapshot.relationshipsFrom;
  delete snapshot.relationshipsTo;
  return snapshot as Prisma.InputJsonValue;
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
