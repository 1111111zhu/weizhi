import { createHash } from "node:crypto";

import JSZip from "jszip";

import { ApiForbiddenException } from "../common/api-error";
import { ZipMasterService } from "./zip-master.service";

type MockAttachment = { id: string; version: number; [key: string]: unknown };
type MockVersion = { id: string; version: number; [key: string]: unknown };
type MockSession = { id: string; [key: string]: unknown };
type MockOperation = { id: string; sequence: number; [key: string]: unknown };
type MockRecord = { id: string; [key: string]: unknown };
type MockPrismaState = {
  attachments: MockAttachment[];
  attachmentVersions: MockVersion[];
  sessions: MockSession[];
  entrySessions: MockSession[];
  operations: MockOperation[];
  zipArchiveSnapshots: MockRecord[];
  zipArchiveEntryCaches: MockRecord[];
};

const user = {
  id: "user-1",
  email: "preparer@example.test",
  name: "Preparer",
  globalRole: "SENIOR",
};
const ZIP_TEST_MODIFIED_AT = "2026-01-02T03:04:04.000Z";
const ZIP_TEST_MODIFIED_DATE = new Date(ZIP_TEST_MODIFIED_AT);
const ZIP_NEW_ENTRY_MODIFIED_AT = "1980-01-01T00:00:00.000Z";

async function zipBuffer(entries: Record<string, string>) {
  await Promise.resolve();
  const zip = new JSZip();
  const folders = new Set<string>();

  for (const [path, content] of Object.entries(entries)) {
    let folderPath = "";
    for (const segment of path.split("/").slice(0, -1)) {
      folderPath += `${segment}/`;
      if (folders.has(folderPath)) {
        continue;
      }
      zip.file(folderPath, null, {
        dir: true,
        date: ZIP_TEST_MODIFIED_DATE,
      });
      folders.add(folderPath);
    }

    zip.file(path, content, { date: ZIP_TEST_MODIFIED_DATE });
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: "attachment-1",
    projectId: "project-1",
    workingPaperId: "paper-1",
    fileKind: "SUPPORTING",
    fileName: "stored.zip",
    originalName: "audit.zip",
    fileUrl: "working-papers/project-1/paper-1/stored.zip",
    fileSize: 128,
    mimeType: "application/zip",
    version: 3,
    headVersionId: "version-3",
    workDate: new Date("2026-06-01T00:00:00.000Z"),
    uploadedBy: "user-1",
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    lockSessionId: null,
    lockHeartbeatAt: null,
    lockStaleAt: null,
    lockRevokedAt: null,
    lockRevokedBy: null,
    lockReleaseReason: null,
    deletedAt: null,
    lockHolder: null,
    ...overrides,
  };
}

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    projectId: "project-1",
    attachmentId: "attachment-1",
    userId: "user-1",
    lockSessionId: "lock-session-1",
    baseVersion: 3,
    baseHash: "base-hash",
    state: "OPEN",
    dirty: false,
    closeResponseJson: null,
    lastError: null,
    entryTreeJson: null,
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    updatedAt: new Date("2026-06-01T08:00:00.000Z"),
    lastSeenAt: new Date("2026-06-01T08:00:00.000Z"),
    closedAt: null,
    ...overrides,
  };
}

function createEntrySession(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-session-1",
    projectId: "project-1",
    attachmentId: "attachment-1",
    zipMasterSessionId: "session-1",
    userId: "user-1",
    entryPath: "support.xlsx",
    fileName: "support.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 3,
    lockSessionId: "entry-lock-1",
    secretHash: hashBuffer(Buffer.from("entry-secret")),
    baseHash: hashBuffer(Buffer.from("old")),
    baseContentObjectKey: null,
    state: "OPEN",
    closeResponseJson: null,
    lastError: null,
    baseOperationSequence: 0,
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    updatedAt: new Date("2026-06-01T08:00:00.000Z"),
    lastSeenAt: new Date("2026-06-01T08:00:00.000Z"),
    closedAt: null,
    ...overrides,
  };
}

function createHarness(input: {
  baseBuffer: Buffer;
  attachment?: MockAttachment;
  sessions?: MockSession[];
  entrySessions?: MockSession[];
  operations?: MockOperation[];
  attachmentVersions?: MockVersion[];
  extraObjects?: Record<string, Buffer>;
}) {
  const state: MockPrismaState = {
    attachments: [input.attachment ?? createAttachment()],
    attachmentVersions: input.attachmentVersions ?? [
      {
        id: "version-3",
        attachmentId: "attachment-1",
        projectId: "project-1",
        version: 3,
        isCurrent: true,
      },
    ],
    sessions: input.sessions ?? [],
    entrySessions: input.entrySessions ?? [],
    operations: input.operations ?? [],
    zipArchiveSnapshots: [],
    zipArchiveEntryCaches: [],
  };
  const objectStore = new Map<string, Buffer>([
    ["working-papers/project-1/paper-1/stored.zip", input.baseBuffer],
    ...Object.entries(input.extraObjects ?? {}),
  ]);
  const storage = {
    getObjectBuffer: vi.fn(async (objectKey: string) => {
      await Promise.resolve();
      const buffer = objectStore.get(objectKey);
      if (!buffer) {
        throw new Error(`Missing object ${objectKey}`);
      }
      return buffer;
    }),
    putZipDraftObject: vi.fn(
      async (
        projectId: string,
        sessionId: string,
        originalName: string,
        body: Buffer
      ) => {
        await Promise.resolve();
        const objectKey = `zip-master-drafts/${projectId}/${sessionId}/${originalName}`;
        objectStore.set(objectKey, body);
        return { fileName: originalName, objectKey };
      }
    ),
    putZipCacheObject: vi.fn(
      async (
        projectId: string,
        attachmentId: string,
        attachmentVersion: number,
        originalName: string,
        body: Buffer
      ) => {
        await Promise.resolve();
        const objectKey = `zip-archive-cache/${projectId}/${attachmentId}/v${attachmentVersion}/${originalName}`;
        objectStore.set(objectKey, body);
        return { fileName: originalName, objectKey };
      }
    ),
    getDownloadObject: vi.fn(
      (objectKey: string, fileName: string, mimeType: string) => ({
        fileName,
        mimeType,
        redirectUrl: `https://oss.example/${objectKey}`,
      })
    ),
    putObject: vi.fn(
      async (
        projectId: string,
        paperId: string,
        originalName: string,
        body: Buffer
      ) => {
        await Promise.resolve();
        const objectKey = `working-papers/${projectId}/${paperId}/checked-in-${originalName}`;
        objectStore.set(objectKey, body);
        return { fileName: `checked-in-${originalName}`, objectKey };
      }
    ),
  };
  const access = {
    requireProjectAction: vi
      .fn()
      .mockResolvedValue({ projectRole: "PREPARER" }),
    requireProjectRole: vi.fn().mockResolvedValue({ projectRole: "PREPARER" }),
    requireProjectMember: vi
      .fn()
      .mockResolvedValue({ projectRole: "PREPARER" }),
  };
  const auditLogs = {
    log: vi.fn().mockResolvedValue(undefined as never),
  };
  const prisma = createPrismaMock(state);
  const service = new ZipMasterService(
    prisma as never,
    storage as never,
    auditLogs as never,
    access as never
  );
  return { access, auditLogs, objectStore, prisma, service, state, storage };
}

function createPrismaMock(state: MockPrismaState) {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = cloneMockPrismaState(state);
      try {
        return await callback(prisma);
      } catch (error) {
        restoreMockPrismaState(state, snapshot);
        throw error;
      }
    }),
    attachment: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.attachments.find((attachment) =>
              matchesWhere(attachment, where)
            ) ?? null
          );
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          const attachment = state.attachments.find((candidate) =>
            matchesWhere(candidate, where)
          );
          if (!attachment) {
            return { count: 0 };
          }
          Object.assign(attachment, data);
          return { count: 1 };
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          const attachment = state.attachments.find(
            (candidate) => candidate.id === where.id
          );
          if (!attachment) {
            throw new Error("Attachment missing");
          }
          Object.assign(attachment, data);
          return attachment;
        }
      ),
    },
    attachmentVersion: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          const versions = state.attachmentVersions
            .filter((version) => matchesWhere(version, where))
            .sort((left, right) => right.version - left.version);
          return versions[0] ?? null;
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          let count = 0;
          for (const version of state.attachmentVersions) {
            if (matchesWhere(version, where)) {
              Object.assign(version, data);
              count += 1;
            }
          }
          return { count };
        }
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          const before = state.attachmentVersions.length;
          state.attachmentVersions = state.attachmentVersions.filter(
            (version) => !matchesWhere(version, where)
          );
          return { count: before - state.attachmentVersions.length };
        }
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        const version: MockVersion = {
          ...data,
          id: `version-${data.version}`,
          version: Number(data.version ?? 0),
        };
        state.attachmentVersions.push(version);
        return version;
      }),
    },
    zipMasterSession: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        const session = {
          id: `session-${state.sessions.length + 1}`,
          closeResponseJson: null,
          closedAt: null,
          ...data,
        };
        state.sessions.push(session);
        return session;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.sessions.find((session) => matchesWhere(session, where)) ??
            null
          );
        }
      ),
      findUnique: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.sessions.find((session) => session.id === where.id) ?? null
          );
        }
      ),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        await Promise.resolve();
        return state.sessions.filter((session) => matchesWhere(session, where));
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          const session = state.sessions.find(
            (candidate) => candidate.id === where.id
          );
          if (!session) {
            throw new Error("Session missing");
          }
          Object.assign(session, data);
          return session;
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          let count = 0;
          for (const session of state.sessions) {
            if (matchesWhere(session, where)) {
              Object.assign(session, data);
              count += 1;
            }
          }
          return { count };
        }
      ),
    },
    zipEntryMasterSession: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        const session = {
          id: `entry-session-${state.entrySessions.length + 1}`,
          closeResponseJson: null,
          closedAt: null,
          ...data,
        };
        state.entrySessions.push(session);
        return session;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.entrySessions.find((session) =>
              matchesWhere(session, where)
            ) ?? null
          );
        }
      ),
      findUnique: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.entrySessions.find((session) => session.id === where.id) ??
            null
          );
        }
      ),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        await Promise.resolve();
        return state.entrySessions.filter((session) =>
          matchesWhere(session, where)
        );
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          const session = state.entrySessions.find(
            (candidate) => candidate.id === where.id
          );
          if (!session) {
            throw new Error("Entry session missing");
          }
          Object.assign(session, data);
          return session;
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          let count = 0;
          for (const session of state.entrySessions) {
            if (matchesWhere(session, where)) {
              Object.assign(session, data);
              count += 1;
            }
          }
          return { count };
        }
      ),
    },
    zipMasterOperation: {
      aggregate: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          const sequences = state.operations
            .filter((operation) => matchesWhere(operation, where))
            .map((operation) => operation.sequence);
          return {
            _max: {
              sequence: sequences.length > 0 ? Math.max(...sequences) : null,
            },
          };
        }
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        const operation: MockOperation = {
          ...data,
          id: `operation-${state.operations.length + 1}`,
          sequence: Number(data.sequence ?? 0),
          createdAt: new Date("2026-06-01T08:00:00.000Z"),
        };
        state.operations.push(operation);
        return operation;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        await Promise.resolve();
        return state.operations
          .filter((operation) => matchesWhere(operation, where))
          .sort((left, right) => left.sequence - right.sequence);
      }),
    },
    zipArchiveSnapshot: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.zipArchiveSnapshots.find((snapshot) =>
              matchesWhere(snapshot, where)
            ) ?? null
          );
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: Record<string, unknown>;
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          const unique = where.attachmentId_attachmentVersion;
          const existing = state.zipArchiveSnapshots.find((snapshot) =>
            matchesWhere(
              snapshot,
              unique && typeof unique === "object"
                ? (unique as Record<string, unknown>)
                : {}
            )
          );
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const snapshot = {
            id: `zip-archive-snapshot-${state.zipArchiveSnapshots.length + 1}`,
            createdAt: new Date("2026-06-01T08:00:00.000Z"),
            updatedAt: new Date("2026-06-01T08:00:00.000Z"),
            ...create,
          };
          state.zipArchiveSnapshots.push(snapshot);
          return snapshot;
        }
      ),
    },
    zipArchiveEntryCache: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          await Promise.resolve();
          return (
            state.zipArchiveEntryCaches.find((cache) =>
              matchesWhere(cache, where)
            ) ?? null
          );
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: Record<string, unknown>;
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => {
          await Promise.resolve();
          const unique = where.attachmentId_attachmentVersion_entryPath;
          const existing = state.zipArchiveEntryCaches.find((cache) =>
            matchesWhere(
              cache,
              unique && typeof unique === "object"
                ? (unique as Record<string, unknown>)
                : {}
            )
          );
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const cache = {
            id: `zip-archive-entry-cache-${state.zipArchiveEntryCaches.length + 1}`,
            createdAt: new Date("2026-06-01T08:00:00.000Z"),
            updatedAt: new Date("2026-06-01T08:00:00.000Z"),
            ...create,
          };
          state.zipArchiveEntryCaches.push(cache);
          return cache;
        }
      ),
    },
  };
  return prisma;
}

function cloneMockPrismaState(state: MockPrismaState): MockPrismaState {
  return {
    attachments: cloneMockValue(state.attachments),
    attachmentVersions: cloneMockValue(state.attachmentVersions),
    sessions: cloneMockValue(state.sessions),
    entrySessions: cloneMockValue(state.entrySessions),
    operations: cloneMockValue(state.operations),
    zipArchiveSnapshots: cloneMockValue(state.zipArchiveSnapshots),
    zipArchiveEntryCaches: cloneMockValue(state.zipArchiveEntryCaches),
  };
}

function restoreMockPrismaState(
  state: MockPrismaState,
  snapshot: MockPrismaState
) {
  state.attachments = snapshot.attachments;
  state.attachmentVersions = snapshot.attachmentVersions;
  state.sessions = snapshot.sessions;
  state.entrySessions = snapshot.entrySessions;
  state.operations = snapshot.operations;
  state.zipArchiveSnapshots = snapshot.zipArchiveSnapshots;
  state.zipArchiveEntryCaches = snapshot.zipArchiveEntryCaches;
}

function cloneMockValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneMockValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneMockValue(item)])
    ) as T;
  }
  return value;
}

function matchesWhere(
  record: Record<string, unknown>,
  where: Record<string, unknown>
) {
  return Object.entries(where ?? {}).every(([key, expected]) => {
    const actual = record[key];
    if (
      expected &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      !(expected instanceof Date)
    ) {
      const matcher = expected as {
        gte?: unknown;
        in?: unknown[];
        not?: unknown;
        notIn?: unknown[];
      };
      if ("not" in matcher) {
        return actual !== matcher.not;
      }
      if ("in" in matcher) {
        return matcher.in?.includes(actual) ?? false;
      }
      if ("notIn" in matcher) {
        return !(matcher.notIn?.includes(actual) ?? false);
      }
      if ("gte" in matcher) {
        return (
          typeof actual === "number" &&
          typeof matcher.gte === "number" &&
          actual >= matcher.gte
        );
      }
    }
    return actual === expected;
  });
}

describe(ZipMasterService, () => {
  it("does not reconcile sessions while background jobs are disabled", async () => {
    vi.stubEnv("PROJECTWING_BACKGROUND_JOBS_ENABLED", "false");
    try {
      const { prisma, service } = createHarness({
        baseBuffer: await zipBuffer({ "base.txt": "base" }),
      });

      await service.reconcileWaitingZipMasterCloses();

      expect(prisma.zipMasterSession.findMany).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("opens zip Master by locking the attachment and creating a session", async () => {
    const baseBuffer = await zipBuffer({ "audit/readme.txt": "base" });
    const { access, auditLogs, service, state } = createHarness({ baseBuffer });
    const response = await service.openMaster(
      "project-1",
      "attachment-1",
      user as never,
      { ipAddress: "127.0.0.1" }
    );

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(response).toMatchObject({
      ok: true,
      mode: "MASTER",
      attachmentId: "attachment-1",
      projectId: "project-1",
      fileName: "audit.zip",
      version: 3,
      state: "OPEN",
      dirty: false,
      entries: [
        {
          name: "audit",
          path: "audit/",
          type: "folder",
          children: [
            {
              name: "readme.txt",
              path: "audit/readme.txt",
              size: 4,
              type: "file",
            },
          ],
        },
      ],
    });
    if (!response.ok) {
      throw new Error("Expected zip Master open to succeed");
    }
    expect(response.lockSessionId).toStrictEqual(expect.any(String));
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: response.lockSessionId,
      lockRevokedAt: null,
      lockReleaseReason: null,
    });
    expect(state.sessions[0]).toMatchObject({
      attachmentId: "attachment-1",
      projectId: "project-1",
      userId: "user-1",
      lockSessionId: response.lockSessionId,
      baseVersion: 3,
      baseHash: hashBuffer(baseBuffer),
      state: "OPEN",
      dirty: false,
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "ATTACHMENT_ZIP_MASTER_OPENED",
        targetId: "attachment-1",
        projectId: "project-1",
      })
    );
  });

  it("recovers the current user's open dirty draft", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockHolder: { id: "user-1", name: "Preparer" },
    });
    const session = createSession({ state: "DIRTY", dirty: true });
    const { prisma, service } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      operations: [
        {
          id: "operation-1",
          sessionId: "session-1",
          sequence: 1,
          type: "CREATE_FOLDER",
          entryPath: "drafts/",
        },
      ],
    });
    const response = await service.openMaster(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      mode: "MASTER",
      sessionId: "session-1",
      lockSessionId: "lock-session-1",
      state: "DIRTY",
      dirty: true,
      entries: [
        { name: "drafts", path: "drafts/", type: "folder", children: [] },
        { name: "base.txt", path: "base.txt", type: "file", size: 4 },
      ],
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(prisma.zipMasterSession.create).not.toHaveBeenCalled();
  });

  it("returns entry Master status in the zip entry tree", async () => {
    const baseBuffer = await zipBuffer({
      "docs/support.xlsx": "old",
      "docs/other.pdf": "other",
    });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockHolder: { id: "user-1", name: "Preparer" },
    });
    const session = createSession();
    const { service } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [
        createEntrySession({
          entryPath: "docs/support.xlsx",
          fileName: "support.xlsx",
          state: "OPEN",
        }),
        createEntrySession({
          id: "entry-session-closed",
          entryPath: "docs/other.pdf",
          fileName: "other.pdf",
          state: "CLOSED",
        }),
      ],
    });
    const response = await service.openMaster(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      entries: [
        {
          path: "docs/",
          type: "folder",
          children: [
            {
              path: "docs/other.pdf",
              type: "file",
            },
            {
              path: "docs/support.xlsx",
              type: "file",
              status: "MASTER",
              masterState: "OPEN",
            },
          ],
        },
      ],
    });
  });

  it("returns locked-by-other without taking over the attachment", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-2",
      lockSessionId: "other-lock-session",
      lockHolder: { id: "user-2", name: "Reviewer" },
    });
    const { prisma, service, state } = createHarness({
      baseBuffer,
      attachment,
    });
    const response = await service.openMaster(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(response).toStrictEqual({
      ok: false,
      code: "LOCKED_BY_OTHER",
      holderName: "Reviewer",
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(state.sessions).toHaveLength(0);
  });

  it("returns locked-by-other when a lock claim loses the race", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const { prisma, service, state } = createHarness({ baseBuffer });
    prisma.attachment.updateMany.mockImplementationOnce(async () => {
      await Promise.resolve();
      Object.assign(state.attachments[0], {
        lockedBy: "user-2",
        lockSessionId: "other-lock-session",
        lockHolder: { id: "user-2", name: "Reviewer" },
      });
      return { count: 0 };
    });

    const response = await service.openMaster(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(response).toStrictEqual({
      ok: false,
      code: "LOCKED_BY_OTHER",
      holderName: "Reviewer",
    });
    expect(state.sessions).toHaveLength(0);
  });

  it("retries open against the current attachment when the base changes before locking", async () => {
    const oldBuffer = await zipBuffer({ "old.txt": "old" });
    const newBuffer = await zipBuffer({ "new.txt": "new" });
    const { objectStore, prisma, service, state } = createHarness({
      baseBuffer: oldBuffer,
    });
    objectStore.set("working-papers/project-1/paper-1/new.zip", newBuffer);
    prisma.attachment.updateMany.mockImplementationOnce(async () => {
      await Promise.resolve();
      Object.assign(state.attachments[0], {
        fileName: "new.zip",
        originalName: "new.zip",
        fileUrl: "working-papers/project-1/paper-1/new.zip",
        version: 4,
        headVersionId: "version-4",
      });
      return { count: 0 };
    });

    const response = await service.openMaster(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      fileName: "new.zip",
      version: 4,
      entries: [{ name: "new.txt", path: "new.txt", size: 3, type: "file" }],
    });
    expect(state.sessions[0]).toMatchObject({
      baseVersion: 4,
      baseHash: hashBuffer(newBuffer),
    });
  });

  it("rejects non-zip attachments before locking", async () => {
    const baseBuffer = Buffer.from("not a zip");
    const attachment = createAttachment({
      fileName: "stored.pdf",
      originalName: "audit.pdf",
      fileUrl: "working-papers/project-1/paper-1/stored.zip",
      mimeType: "application/pdf",
    });
    const { prisma, service, state } = createHarness({
      baseBuffer,
      attachment,
    });

    await expect(
      service.openMaster("project-1", "attachment-1", user as never)
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_FAILED" },
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(state.sessions).toHaveLength(0);
  });

  it("rejects malformed zip content before locking", async () => {
    const attachment = createAttachment();
    const { prisma, service, state } = createHarness({
      baseBuffer: Buffer.from("not a zip"),
      attachment,
    });

    await expect(
      service.openMaster("project-1", "attachment-1", user as never)
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_FAILED" },
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(state.sessions).toHaveLength(0);
  });

  it("returns read-only zip entries without locking the attachment", async () => {
    const baseBuffer = await zipBuffer({ "support/evidence.txt": "ok" });
    const { access, prisma, service } = createHarness({ baseBuffer });
    const response = await service.readOnly(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(response).toMatchObject({
      ok: true,
      mode: "READ_ONLY",
      attachmentId: "attachment-1",
      projectId: "project-1",
      fileName: "audit.zip",
      version: 3,
    });
    expect(response.entries).toStrictEqual([
      {
        name: "support",
        path: "support/",
        type: "folder",
        modifiedAt: ZIP_TEST_MODIFIED_AT,
        children: [
          {
            name: "evidence.txt",
            path: "support/evidence.txt",
            size: 2,
            type: "file",
            modifiedAt: ZIP_TEST_MODIFIED_AT,
          },
        ],
      },
    ]);
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("returns cached read-only zip entries without rereading the archive", async () => {
    const baseBuffer = await zipBuffer({ "support/evidence.txt": "ok" });
    const { service, storage } = createHarness({ baseBuffer });
    const first = await service.readOnly(
      "project-1",
      "attachment-1",
      user as never
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledOnce();
    storage.getObjectBuffer.mockClear();

    const second = await service.readOnly(
      "project-1",
      "attachment-1",
      user as never
    );

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(second.entries).toStrictEqual(first.entries);
  });

  it("downloads a read-only zip entry without locking the attachment", async () => {
    const baseBuffer = await zipBuffer({ "support/evidence.pdf": "pdf" });
    const { access, prisma, service, storage } = createHarness({ baseBuffer });
    const response = await service.downloadReadOnlyEntry(
      "project-1",
      "attachment-1",
      " support//evidence.pdf ",
      user as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "zip-archive-cache/project-1/attachment-1/v3/evidence.pdf",
      "evidence.pdf",
      "application/pdf"
    );
    expect(response).toStrictEqual({
      fileName: "evidence.pdf",
      mimeType: "application/pdf",
      redirectUrl:
        "https://oss.example/zip-archive-cache/project-1/attachment-1/v3/evidence.pdf",
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("downloads a cached read-only zip entry without rereading the archive", async () => {
    const baseBuffer = await zipBuffer({ "support/evidence.pdf": "pdf" });
    const { service, storage } = createHarness({ baseBuffer });
    const first = await service.downloadReadOnlyEntry(
      "project-1",
      "attachment-1",
      "support/evidence.pdf",
      user as never
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledOnce();
    storage.getObjectBuffer.mockClear();
    storage.getDownloadObject.mockClear();

    const second = await service.downloadReadOnlyEntry(
      "project-1",
      "attachment-1",
      "support/evidence.pdf",
      user as never
    );

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "zip-archive-cache/project-1/attachment-1/v3/evidence.pdf",
      "evidence.pdf",
      "application/pdf"
    );
    expect(second).toStrictEqual(first);
  });

  it("stores an uploaded file and appends the next operation sequence", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession();
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      operations: [
        {
          id: "operation-1",
          sessionId: "session-1",
          sequence: 1,
          type: "CREATE_FOLDER",
          entryPath: "evidence/",
        },
      ],
    });
    const response = await service.addOperation(
      "project-1",
      "session-1",
      user as never,
      { type: "ADD_FILE", entryPath: "evidence/support.txt" },
      {
        originalname: "support.txt",
        mimetype: "text/plain",
        size: 7,
        buffer: Buffer.from("support"),
      }
    );

    expect(storage.putZipDraftObject).toHaveBeenCalledWith(
      "project-1",
      "session-1",
      "support.txt",
      Buffer.from("support"),
      "text/plain"
    );
    expect(state.operations[1]).toMatchObject({
      sessionId: "session-1",
      sequence: 2,
      type: "ADD_FILE",
      entryPath: "evidence/support.txt",
      objectKey: "zip-master-drafts/project-1/session-1/support.txt",
      fileName: "support.txt",
      mimeType: "text/plain",
      fileSize: 7,
    });
    expect(state.sessions[0]).toMatchObject({ state: "DIRTY", dirty: true });
    expect(response).toMatchObject({
      ok: true,
      mode: "MASTER",
      sessionId: "session-1",
      state: "DIRTY",
      dirty: true,
    });
    expect(response.entries).toStrictEqual([
      {
        name: "evidence",
        path: "evidence/",
        type: "folder",
        modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
        children: [
          {
            name: "support.txt",
            path: "evidence/support.txt",
            size: 7,
            type: "file",
            modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
          },
        ],
      },
      {
        name: "base.txt",
        path: "base.txt",
        size: 4,
        type: "file",
        modifiedAt: ZIP_TEST_MODIFIED_AT,
      },
    ]);
  });

  it("stores copy operations and recomputes the zip entry tree", async () => {
    const baseBuffer = await zipBuffer({ "source.txt": "source" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    const response = await service.addOperation(
      "project-1",
      "session-1",
      user as never,
      {
        type: "COPY_ENTRY",
        entryPath: "source.txt",
        targetPath: "copy/source.txt",
      }
    );

    expect(state.operations[0]).toMatchObject({
      sessionId: "session-1",
      sequence: 1,
      type: "COPY_ENTRY",
      entryPath: "source.txt",
      targetPath: "copy/source.txt",
    });
    expect(response.entries).toStrictEqual([
      {
        name: "copy",
        path: "copy/",
        type: "folder",
        modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
        children: [
          {
            name: "source.txt",
            path: "copy/source.txt",
            size: 6,
            type: "file",
            modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
          },
        ],
      },
      {
        name: "source.txt",
        path: "source.txt",
        size: 6,
        type: "file",
        modifiedAt: ZIP_TEST_MODIFIED_AT,
      },
    ]);
  });

  it("appends operations without materializing existing draft blobs", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession();
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      operations: [
        {
          id: "operation-1",
          sessionId: "session-1",
          sequence: 1,
          type: "ADD_FILE",
          entryPath: "evidence/support.txt",
          objectKey: "zip-drafts/session-1/support.txt",
          fileName: "support.txt",
          mimeType: "text/plain",
          fileSize: 7,
        },
      ],
      extraObjects: {
        "zip-drafts/session-1/support.txt": Buffer.from("support"),
      },
    });
    const response = await service.addOperation(
      "project-1",
      "session-1",
      user as never,
      { type: "CREATE_FOLDER", entryPath: "notes/" }
    );

    expect(storage.getObjectBuffer).toHaveBeenCalledExactlyOnceWith(
      "working-papers/project-1/paper-1/stored.zip"
    );
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(state.operations[1]).toMatchObject({
      sessionId: "session-1",
      sequence: 2,
      type: "CREATE_FOLDER",
      entryPath: "notes/",
    });
    expect(response.entries).toStrictEqual([
      {
        name: "evidence",
        path: "evidence/",
        type: "folder",
        modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
        children: [
          {
            name: "support.txt",
            path: "evidence/support.txt",
            size: 7,
            type: "file",
            modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
          },
        ],
      },
      {
        name: "notes",
        path: "notes/",
        type: "folder",
        modifiedAt: ZIP_NEW_ENTRY_MODIFIED_AT,
        children: [],
      },
      {
        name: "base.txt",
        path: "base.txt",
        size: 4,
        type: "file",
        modifiedAt: ZIP_TEST_MODIFIED_AT,
      },
    ]);
  });

  it("opens a zip entry Master session with desktop callback URLs", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    const response = await service.openEntryMaster(
      "project-1",
      "session-1",
      "support.xlsx",
      user as never,
      {
        protocol: "https",
        host: "wing.test",
        pathPrefix: "/api",
      }
    );

    expect(response).toMatchObject({
      ok: true,
      mode: "ZIP_ENTRY_MASTER",
      projectId: "project-1",
      attachmentId: expect.stringMatching(/^zip-entry:attachment-1:/),
      zipMasterSessionId: "session-1",
      entryPath: "support.xlsx",
      fileName: "support.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSize: 3,
      baseVersion: 3,
      contentToken: hashBuffer(Buffer.from("old")),
      contentHash: hashBuffer(Buffer.from("old")),
      downloadUrl:
        "https://wing.test/api/engagement/project-1/workflow/zip-master-sessions/session-1/entries/download?path=support.xlsx",
    });
    expect(response.lockSessionId).toStrictEqual(expect.any(String));
    expect(response.grantSecret).toStrictEqual(expect.any(String));
    expect(response.checkInUrl).toBe(
      `https://wing.test/api/desktop/zip-entry-master-sessions/${response.lockSessionId}/check-in`
    );
    expect(response.heartbeatUrl).toBe(
      `https://wing.test/api/desktop/zip-entry-master-sessions/${response.lockSessionId}/heartbeat`
    );
    expect(response.releaseUrl).toBe(
      `https://wing.test/api/desktop/zip-entry-master-sessions/${response.lockSessionId}/release`
    );
    expect(state.entrySessions[0]).toMatchObject({
      projectId: "project-1",
      attachmentId: "attachment-1",
      zipMasterSessionId: "session-1",
      userId: "user-1",
      entryPath: "support.xlsx",
      fileName: "support.xlsx",
      fileSize: 3,
      baseHash: hashBuffer(Buffer.from("old")),
      baseContentObjectKey:
        "zip-master-drafts/project-1/session-1/base-entry-session-1.xlsx",
      state: "OPEN",
    });
    expect(state.entrySessions[0].secretHash).not.toBe(response.grantSecret);
  });

  it("heartbeats both the zip entry session and its parent attachment lock", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const response = await service.heartbeatEntryMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "entry-lock-1",
      grantSecret: "entry-secret",
    });

    expect(response).toMatchObject({
      ok: true,
      lockSessionId: "entry-lock-1",
    });
    expect(state.entrySessions[0].lastSeenAt).toStrictEqual(
      new Date(response.heartbeatAt)
    );
    expect(state.attachments[0].lockHeartbeatAt).toStrictEqual(
      new Date(response.heartbeatAt)
    );
  });

  it("blocks revoked project access through existing zip tokens but still permits entry cleanup", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const { service, state, access } = createHarness({
      baseBuffer,
      attachment: createAttachment({
        lockedBy: "user-1",
        lockSessionId: "lock-session-1",
      }),
      sessions: [createSession({ baseHash: hashBuffer(baseBuffer) })],
      entrySessions: [createEntrySession()],
    });
    access.requireProjectAction.mockRejectedValue(
      new ApiForbiddenException("FORBIDDEN", "Project access suspended")
    );
    const input = {
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "entry-lock-1",
      grantSecret: "entry-secret",
    };
    await expect(
      service.heartbeatEntryMasterSession(input)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    expect(state.operations).toHaveLength(0);
    await expect(
      service.releaseEntryMasterSession({ ...input, reason: "RECOVERY_ENDED" })
    ).resolves.toMatchObject({ ok: true, recoveryEnded: true });
    expect(state.attachments[0].version).toBe(3);
    expect(state.operations).toHaveLength(0);
  });

  it("downloads a zip Master session entry after draft operations", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const { service } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      operations: [
        {
          id: "operation-1",
          sessionId: "session-1",
          sequence: 1,
          type: "REPLACE_FILE",
          entryPath: "support.xlsx",
          objectKey: "zip-master-drafts/project-1/session-1/support.xlsx",
          fileName: "support.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileSize: 3,
        },
      ],
      extraObjects: {
        "zip-master-drafts/project-1/session-1/support.xlsx":
          Buffer.from("new"),
      },
    });
    const response = await service.downloadSessionEntry(
      "project-1",
      "session-1",
      "support.xlsx",
      user as never
    );

    expect(response).toStrictEqual({
      fileName: "support.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("new"),
    });
  });

  it("downloads an opened zip entry Master session from cached content", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      entryTreeJson: [
        {
          name: "support.xlsx",
          path: "support.xlsx",
          size: 3,
          type: "file",
          modifiedAt: ZIP_TEST_MODIFIED_AT,
        },
      ],
    });
    const { service, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await service.openEntryMaster(
      "project-1",
      "session-1",
      "support.xlsx",
      user as never,
      {
        protocol: "https",
        host: "wing.test",
        pathPrefix: "/api",
      }
    );

    expect(storage.getObjectBuffer).toHaveBeenCalledExactlyOnceWith(
      "working-papers/project-1/paper-1/stored.zip"
    );
    storage.getObjectBuffer.mockClear();

    const response = await service.downloadSessionEntry(
      "project-1",
      "session-1",
      "support.xlsx",
      user as never
    );

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "zip-master-drafts/project-1/session-1/base-entry-session-1.xlsx",
      "support.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    storage.getObjectBuffer.mockClear();
    storage.getDownloadObject.mockClear();

    const cachedResponse = await service.downloadSessionEntry(
      "project-1",
      "session-1",
      "support.xlsx",
      user as never
    );

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "zip-master-drafts/project-1/session-1/base-entry-session-1.xlsx",
      "support.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(cachedResponse).toStrictEqual(response);
    expect(response).toStrictEqual({
      fileName: "support.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      redirectUrl:
        "https://oss.example/zip-master-drafts/project-1/session-1/base-entry-session-1.xlsx",
    });
  });

  it("returns a virtual attachment id for zip entry Master tracking", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const { service } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    const response = await service.openEntryMaster(
      "project-1",
      "session-1",
      "support.xlsx",
      user as never,
      {
        protocol: "https",
        host: "wing.test",
        pathPrefix: "/api",
      }
    );

    expect(response).toMatchObject({
      ok: true,
      mode: "ZIP_ENTRY_MASTER",
      attachmentId: expect.stringMatching(/^zip-entry:attachment-1:/),
      entryPath: "support.xlsx",
      lockSessionId: expect.any(String),
    });
  });

  it("checks in a zip entry Master session as an outer replace operation", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const response = await service.checkInEntryMasterSession(
      {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "entry-lock-1",
        grantSecret: "entry-secret",
        baseVersion: 3,
        localContentHash: hashBuffer(Buffer.from("new")),
        idempotencyKey: "entry-lock-1:new",
      },
      {
        originalname: "support.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 3,
        buffer: Buffer.from("new"),
      },
      { ipAddress: "127.0.0.1" }
    );

    expect(storage.putZipDraftObject).toHaveBeenCalledWith(
      "project-1",
      "session-1",
      "support.xlsx",
      Buffer.from("new"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(state.operations[0]).toMatchObject({
      sessionId: "session-1",
      sequence: 1,
      type: "REPLACE_FILE",
      entryPath: "support.xlsx",
      objectKey: "zip-master-drafts/project-1/session-1/support.xlsx",
    });
    expect(state.sessions[0]).toMatchObject({ state: "DIRTY", dirty: true });
    expect(state.entrySessions[0]).toMatchObject({
      state: "CLOSED",
      closeResponseJson: response,
    });
    expect(response).toMatchObject({
      ok: true,
      uploaded: true,
      projectId: "project-1",
      attachmentId: "attachment-1",
      zipMasterSessionId: "session-1",
      entryPath: "support.xlsx",
      lockSessionId: "entry-lock-1",
      localContentHash: hashBuffer(Buffer.from("new")),
    });
  });

  it("checks in a zip entry Master session with a virtual attachment id", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const response = await service.checkInEntryMasterSession(
      {
        projectId: "project-1",
        attachmentId: "zip-entry:entry-session-1",
        lockSessionId: "entry-lock-1",
        grantSecret: "entry-secret",
        baseVersion: 3,
        localContentHash: hashBuffer(Buffer.from("new")),
        idempotencyKey: "entry-lock-1:new",
      },
      {
        originalname: "support.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 3,
        buffer: Buffer.from("new"),
      }
    );

    expect(response).toMatchObject({
      ok: true,
      uploaded: true,
      projectId: "project-1",
      attachmentId: "attachment-1",
      zipMasterSessionId: "session-1",
      entryPath: "support.xlsx",
      lockSessionId: "entry-lock-1",
    });
    expect(state.operations[0]).toMatchObject({
      type: "REPLACE_FILE",
      entryPath: "support.xlsx",
    });
  });

  it("checks in modified zip entries without rebuilding the parent zip", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const generateZip = vi.spyOn(JSZip.prototype, "generateAsync");

    try {
      const response = await service.checkInEntryMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "entry-lock-1",
          grantSecret: "entry-secret",
          baseVersion: 3,
          localContentHash: hashBuffer(Buffer.from("new")),
          idempotencyKey: "entry-lock-1:new",
        },
        {
          originalname: "support.xlsx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 3,
          buffer: Buffer.from("new"),
        }
      );

      expect(response).toMatchObject({ ok: true, uploaded: true });
      expect(generateZip).not.toHaveBeenCalled();
      expect(state.operations[0]).toMatchObject({
        type: "REPLACE_FILE",
        entryPath: "support.xlsx",
        objectKey: "zip-master-drafts/project-1/session-1/support.xlsx",
      });
    } finally {
      generateZip.mockRestore();
    }
  });

  it("releases a zip entry Master session without changing outer operations", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const response = await service.releaseEntryMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "entry-lock-1",
      grantSecret: "entry-secret",
      reason: "UNCHANGED_RELEASE",
    });

    expect(state.operations).toHaveLength(0);
    expect(state.entrySessions[0]).toMatchObject({
      state: "CLOSED",
      closeResponseJson: response,
    });
    expect(response).toMatchObject({
      ok: true,
      released: true,
      projectId: "project-1",
      attachmentId: "attachment-1",
      zipMasterSessionId: "session-1",
      entryPath: "support.xlsx",
      lockSessionId: "entry-lock-1",
    });
  });

  it("releases a zip entry Master session with a virtual attachment id", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const response = await service.releaseEntryMasterSession({
      projectId: "project-1",
      attachmentId: "zip-entry:entry-session-1",
      lockSessionId: "entry-lock-1",
      grantSecret: "entry-secret",
      reason: "UNCHANGED_RELEASE",
    });

    expect(state.operations).toHaveLength(0);
    expect(response).toMatchObject({
      ok: true,
      released: true,
      projectId: "project-1",
      attachmentId: "attachment-1",
      zipMasterSessionId: "session-1",
      entryPath: "support.xlsx",
      lockSessionId: "entry-lock-1",
    });
  });

  it("waits to close the parent zip while an entry Master is still active", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    const response = await service.close(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      waitingForEntries: true,
      queued: false,
      activeEntryMasters: [{ entryPath: "support.xlsx", state: "OPEN" }],
    });
    expect(state.sessions[0]).toMatchObject({
      state: "CLOSING_WAITING_ENTRIES",
      dirty: false,
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("reconciles an orphaned close barrier after all entry Masters are closed", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      state: "CLOSING_WAITING_ENTRIES",
    });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await service.reconcileWaitingZipMasterCloses();

    expect(state.sessions[0]).toMatchObject({ state: "CLOSED", dirty: false });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "UNCHANGED_RELEASE",
    });
  });

  it("releases an unchanged parent automatically after the last entry Master closes", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });

    await service.close("project-1", "session-1", user as never);
    await service.releaseEntryMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "entry-lock-1",
      grantSecret: "entry-secret",
      reason: "UNCHANGED_RELEASE",
    });

    expect(state.entrySessions[0]).toMatchObject({ state: "CLOSED" });
    expect(state.sessions[0]).toMatchObject({
      state: "CLOSED",
      dirty: false,
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "UNCHANGED_RELEASE",
    });
  });

  it("keeps the parent close barrier until every entry Master is terminal", async () => {
    const baseBuffer = await zipBuffer({
      "support.xlsx": "old",
      "evidence.pdf": "pdf",
    });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySessions = [
      createEntrySession(),
      createEntrySession({
        id: "entry-session-2",
        entryPath: "evidence.pdf",
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        fileSize: 3,
        lockSessionId: "entry-lock-2",
        secretHash: hashBuffer(Buffer.from("entry-secret-2")),
        baseHash: hashBuffer(Buffer.from("pdf")),
      }),
    ];
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions,
    });

    await service.close("project-1", "session-1", user as never);
    await service.releaseEntryMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "entry-lock-1",
      grantSecret: "entry-secret",
      reason: "UNCHANGED_RELEASE",
    });

    expect(state.sessions[0]).toMatchObject({
      state: "CLOSING_WAITING_ENTRIES",
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });

    await service.releaseEntryMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "entry-lock-2",
      grantSecret: "entry-secret-2",
      reason: "UNCHANGED_RELEASE",
    });

    expect(state.sessions[0]).toMatchObject({ state: "CLOSED" });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
    });
  });

  it("accepts the last entry check-in while closing and then rebuilds the parent once", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ baseHash: hashBuffer(baseBuffer) });
    const entrySession = createEntrySession();
    const { objectStore, service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });

    await service.close("project-1", "session-1", user as never);
    await service.checkInEntryMasterSession(
      {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "entry-lock-1",
        grantSecret: "entry-secret",
        baseVersion: 3,
        localContentHash: hashBuffer(Buffer.from("new")),
        idempotencyKey: "entry-lock-1:new",
      },
      {
        originalname: "support.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 3,
        buffer: Buffer.from("new"),
      }
    );

    expect(state.sessions[0]).toMatchObject({
      state: "CHECKING_IN",
      dirty: true,
    });
    expect(state.operations).toHaveLength(1);
    expect(storage.putObject).not.toHaveBeenCalled();

    await (
      service as unknown as {
        finishQueuedZipMasterCheckIn: (
          sessionId: string,
          user: { id: string }
        ) => Promise<void>;
      }
    ).finishQueuedZipMasterCheckIn("session-1", user as never);

    expect(storage.putObject).toHaveBeenCalledOnce();
    expect(state.sessions[0]).toMatchObject({ state: "CLOSED", dirty: false });
    const stored = objectStore.get(
      "working-papers/project-1/paper-1/checked-in-audit.zip"
    );
    const rebuilt = await JSZip.loadAsync(stored as Buffer);
    await expect(rebuilt.file("support.xlsx")?.async("string")).resolves.toBe(
      "new"
    );
  });

  it("prevents a new entry Master from winning a race with parent close", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      entryTreeJson: [
        {
          type: "file",
          name: "support.xlsx",
          path: "support.xlsx",
          size: 3,
          modifiedAt: ZIP_TEST_MODIFIED_AT,
        },
      ],
    });
    const { prisma, service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    prisma.zipMasterSession.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.openEntryMaster(
        "project-1",
        "session-1",
        "support.xlsx",
        user as never,
        {
          protocol: "https",
          host: "wing.test",
          pathPrefix: "/api",
        }
      )
    ).rejects.toMatchObject({
      response: { code: "ZIP_MASTER_CLOSING" },
    });
    expect(state.entrySessions).toHaveLength(0);
  });

  it("blocks operations when the attachment lock no longer belongs to the session", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-2",
      lockSessionId: "other-lock-session",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
    });
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await expect(
      service.addOperation("project-1", "session-1", user as never, {
        type: "CREATE_FOLDER",
        entryPath: "drafts/",
      })
    ).rejects.toMatchObject({
      response: { code: "LOCK_REVOKED" },
    });
    expect(state.sessions[0]).toMatchObject({ state: "LOCK_REVOKED" });
    expect(state.operations).toHaveLength(0);
    expect(storage.putZipDraftObject).not.toHaveBeenCalled();
  });

  it("rejects invalid semantic operations before persisting them", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
    });
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await expect(
      service.addOperation("project-1", "session-1", user as never, {
        type: "DELETE_ENTRY",
        entryPath: "missing.txt",
      })
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_FAILED" },
    });
    expect(state.operations).toHaveLength(0);
    expect(state.sessions[0]).toMatchObject({ state: "OPEN", dirty: false });
    expect(storage.putZipDraftObject).not.toHaveBeenCalled();
  });

  it("rejects invalid uploaded file names before storing draft content", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
    });
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await expect(
      service.addOperation(
        "project-1",
        "session-1",
        user as never,
        { type: "ADD_FILE", entryPath: "support.txt" },
        {
          originalname: "\0",
          mimetype: "text/plain",
          size: 7,
          buffer: Buffer.from("support"),
        }
      )
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_FAILED" },
    });
    expect(state.operations).toHaveLength(0);
    expect(storage.putZipDraftObject).not.toHaveBeenCalled();
  });

  it("revalidates operations after claiming the session row", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
    });
    const { prisma, service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    prisma.zipMasterSession.updateMany.mockImplementationOnce(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        await Promise.resolve();
        const candidate = state.sessions.find((item) =>
          matchesWhere(item, where)
        );
        if (!candidate) {
          return { count: 0 };
        }
        Object.assign(candidate, data);
        state.operations.push({
          id: "operation-race",
          sessionId: "session-1",
          sequence: 1,
          type: "CREATE_FOLDER",
          entryPath: "drafts/",
        });
        return { count: 1 };
      }
    );

    await expect(
      service.addOperation("project-1", "session-1", user as never, {
        type: "CREATE_FOLDER",
        entryPath: "drafts/",
      })
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_FAILED" },
    });
    expect(prisma.zipMasterOperation.create).not.toHaveBeenCalled();
    expect(state.operations).toHaveLength(0);
  });

  it("adds operations against the stored entry tree without reading the zip object", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
      entryTreeJson: [
        {
          name: "base.txt",
          path: "base.txt",
          size: 4,
          type: "file",
          modifiedAt: ZIP_TEST_MODIFIED_AT,
        },
      ],
    });
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    storage.getObjectBuffer.mockClear();

    const response = await service.addOperation(
      "project-1",
      "session-1",
      user as never,
      {
        type: "CREATE_FOLDER",
        entryPath: "drafts/",
      }
    );

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      state: "DIRTY",
      dirty: true,
      entries: [
        {
          name: "drafts",
          path: "drafts/",
          type: "folder",
          children: [],
        },
        {
          name: "base.txt",
          path: "base.txt",
          size: 4,
          type: "file",
          modifiedAt: ZIP_TEST_MODIFIED_AT,
        },
      ],
    });
    expect(state.operations).toContainEqual(
      expect.objectContaining({
        type: "CREATE_FOLDER",
        entryPath: "drafts/",
      })
    );
  });

  it("closes an unchanged session by releasing the lock without a new version", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
    });
    const { auditLogs, service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    const response = await service.close(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      checkedIn: false,
      discarded: false,
      version: 3,
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "UNCHANGED_RELEASE",
      version: 3,
    });
    expect(state.sessions[0]).toMatchObject({
      state: "CLOSED",
      closeResponseJson: response,
    });
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(state.attachmentVersions).toHaveLength(1);
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_ZIP_MASTER_RELEASED" })
    );
  });

  it("returns cached close response for already closed sessions", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const closeResponse = {
      ok: true,
      checkedIn: false,
      discarded: false,
      version: 3,
    };
    const session = createSession({
      state: "CLOSED",
      closeResponseJson: closeResponse,
      closedAt: new Date("2026-06-01T09:00:00.000Z"),
    });
    const { prisma, service, storage } = createHarness({
      baseBuffer,
      sessions: [session],
    });

    await expect(
      service.close("project-1", "session-1", user as never)
    ).resolves.toBe(closeResponse);
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("blocks close when the attachment version changed", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      version: 4,
    });
    const session = createSession({ baseVersion: 3, dirty: false });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await expect(
      service.close("project-1", "session-1", user as never)
    ).rejects.toMatchObject({
      response: { code: "CONFLICT_RISK" },
    });
    expect(state.sessions[0]).toMatchObject({
      state: "BASE_VERSION_CONFLICT",
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      version: 4,
    });
  });

  it("closes an unchanged session without reading the base zip hash", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: "different-hash",
      dirty: false,
      state: "OPEN",
    });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    const response = await service.close(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      checkedIn: false,
      discarded: false,
      version: 3,
    });
    expect(state.sessions[0]).toMatchObject({
      state: "CLOSED",
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
    });
  });

  it("allows discard after a queued base hash conflict keeps the lock active", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: "different-hash",
      dirty: true,
      state: "CHECKING_IN",
    });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await (
      service as unknown as {
        finishQueuedZipMasterCheckIn: (
          sessionId: string,
          user: { id: string }
        ) => Promise<void>;
      }
    ).finishQueuedZipMasterCheckIn("session-1", user as never);
    expect(state.sessions[0]).toMatchObject({
      state: "BASE_VERSION_CONFLICT",
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });

    const response = await service.discard(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      checkedIn: false,
      discarded: true,
      version: 3,
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "DISCARDED",
    });
    expect(state.sessions[0]).toMatchObject({ state: "CLOSED" });
  });

  it("allows discard after a base version conflict keeps the lock active", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      version: 4,
      headVersionId: "version-4",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      baseVersion: 3,
      dirty: false,
      state: "OPEN",
    });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      attachmentVersions: [
        {
          id: "version-4",
          attachmentId: "attachment-1",
          projectId: "project-1",
          version: 4,
          isCurrent: true,
        },
      ],
    });

    await expect(
      service.close("project-1", "session-1", user as never)
    ).rejects.toMatchObject({
      response: { code: "CONFLICT_RISK" },
    });

    const response = await service.discard(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      checkedIn: false,
      discarded: true,
      version: 4,
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "DISCARDED",
      version: 4,
      headVersionId: "version-4",
    });
    expect(state.sessions[0]).toMatchObject({ state: "CLOSED" });
  });

  it("does not release a newer lock when transaction compare-and-swap fails", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
    });
    const { prisma, service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    prisma.attachment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.close("project-1", "session-1", user as never)
    ).rejects.toMatchObject({
      response: { code: "LOCK_REVOKED" },
    });
    expect(state.sessions[0]).toMatchObject({ state: "LOCK_REVOKED" });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
  });

  it("finishes a queued dirty close by rebuilding the zip and checking in a new version", async () => {
    const baseBuffer = await zipBuffer({ "replace.txt": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: true,
      state: "CHECKING_IN",
    });
    const { auditLogs, objectStore, service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      operations: [
        {
          id: "operation-1",
          sessionId: "session-1",
          sequence: 1,
          type: "REPLACE_FILE",
          entryPath: "replace.txt",
          objectKey: "zip-master-drafts/project-1/session-1/replacement.txt",
          fileName: "replacement.txt",
          mimeType: "text/plain",
          fileSize: 3,
        },
      ],
      extraObjects: {
        "zip-master-drafts/project-1/session-1/replacement.txt":
          Buffer.from("new"),
      },
    });

    await (
      service as unknown as {
        finishQueuedZipMasterCheckIn: (
          sessionId: string,
          user: { id: string }
        ) => Promise<void>;
      }
    ).finishQueuedZipMasterCheckIn("session-1", user as never);
    const response = state.sessions[0].closeResponseJson;

    expect(response).toMatchObject({
      ok: true,
      checkedIn: true,
      discarded: false,
      version: 4,
    });
    expect(storage.putObject).toHaveBeenCalledWith(
      "project-1",
      "paper-1",
      "audit.zip",
      expect.any(Buffer),
      "application/zip"
    );
    const stored = objectStore.get(
      "working-papers/project-1/paper-1/checked-in-audit.zip"
    );
    expect(stored).toBeDefined();
    const rebuilt = await JSZip.loadAsync(stored as Buffer);
    await expect(rebuilt.file("replace.txt")?.async("string")).resolves.toBe(
      "new"
    );
    expect(state.attachmentVersions).toContainEqual(
      expect.objectContaining({
        attachmentId: "attachment-1",
        version: 4,
        parentVersionId: "version-3",
        action: "CHECK_IN",
        fileUrl: "working-papers/project-1/paper-1/checked-in-audit.zip",
      })
    );
    expect(state.attachments[0]).toMatchObject({
      fileName: "checked-in-audit.zip",
      fileUrl: "working-papers/project-1/paper-1/checked-in-audit.zip",
      version: 4,
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "CHECKED_IN",
      lastModifiedBy: "user-1",
    });
    expect(state.sessions[0]).toMatchObject({
      state: "CLOSED",
      closeResponseJson: response,
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_ZIP_MASTER_CHECKED_IN" })
    );
  });

  it("queues dirty close without rebuilding and uploading the zip in the request", async () => {
    const baseBuffer = await zipBuffer({ "replace.txt": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: true,
      state: "DIRTY",
      entryTreeJson: [
        {
          name: "replace.txt",
          path: "replace.txt",
          size: 3,
          type: "file",
          modifiedAt: ZIP_TEST_MODIFIED_AT,
        },
      ],
    });
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      operations: [
        {
          id: "operation-1",
          sessionId: "session-1",
          sequence: 1,
          type: "REPLACE_FILE",
          entryPath: "replace.txt",
          objectKey: "zip-master-drafts/project-1/session-1/replacement.txt",
          fileName: "replacement.txt",
          mimeType: "text/plain",
          fileSize: 3,
        },
      ],
      extraObjects: {
        "zip-master-drafts/project-1/session-1/replacement.txt":
          Buffer.from("new"),
      },
    });
    const response = await service.close(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      checkedIn: false,
      discarded: false,
      queued: true,
      version: 3,
    });
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(state.attachments[0]).toMatchObject({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      version: 3,
      headVersionId: "version-3",
    });
    expect(state.sessions[0]).toMatchObject({
      state: "CHECKING_IN",
      dirty: true,
      closeResponseJson: null,
    });
  });

  it("checks in zip entry Master without reading or rebuilding the zip object", async () => {
    const baseBuffer = await zipBuffer({ "support.xlsx": "old" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({
      baseHash: hashBuffer(baseBuffer),
      dirty: false,
      state: "OPEN",
      entryTreeJson: [
        {
          name: "support.xlsx",
          path: "support.xlsx",
          size: 3,
          type: "file",
          modifiedAt: ZIP_TEST_MODIFIED_AT,
        },
      ],
    });
    const entrySession = createEntrySession({
      baseHash: hashBuffer(Buffer.from("old")),
      baseOperationSequence: 0,
    });
    const { service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
      entrySessions: [entrySession],
    });
    storage.getObjectBuffer.mockClear();

    const response = await service.checkInEntryMasterSession(
      {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "entry-lock-1",
        grantSecret: "entry-secret",
        baseVersion: 3,
        localContentHash: hashBuffer(Buffer.from("new")),
        idempotencyKey: "entry-check-in-1",
      },
      {
        originalname: "support.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 3,
        buffer: Buffer.from("new"),
      }
    );

    expect(response).toMatchObject({
      ok: true,
      uploaded: true,
      entryPath: "support.xlsx",
    });
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(storage.putZipDraftObject).toHaveBeenCalledWith(
      "project-1",
      "session-1",
      "support.xlsx",
      Buffer.from("new"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(state.sessions[0]).toMatchObject({
      state: "DIRTY",
      dirty: true,
    });
    expect(state.operations).toContainEqual(
      expect.objectContaining({
        type: "REPLACE_FILE",
        entryPath: "support.xlsx",
      })
    );
  });

  it("blocks close when the attachment lock no longer belongs to the session", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-2",
      lockSessionId: "other-lock-session",
    });
    const session = createSession({ dirty: true, state: "DIRTY" });
    const { service, state } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });

    await expect(
      service.close("project-1", "session-1", user as never)
    ).rejects.toMatchObject({
      response: { code: "LOCK_REVOKED" },
    });
    expect(state.sessions[0]).toMatchObject({ state: "LOCK_REVOKED" });
  });

  it("discards a session by releasing the lock without creating a version", async () => {
    const baseBuffer = await zipBuffer({ "base.txt": "base" });
    const attachment = createAttachment({
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const session = createSession({ dirty: true, state: "DIRTY" });
    const { auditLogs, service, state, storage } = createHarness({
      baseBuffer,
      attachment,
      sessions: [session],
    });
    const response = await service.discard(
      "project-1",
      "session-1",
      user as never
    );

    expect(response).toMatchObject({
      ok: true,
      checkedIn: false,
      discarded: true,
      version: 3,
    });
    expect(state.attachments[0]).toMatchObject({
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "DISCARDED",
      version: 3,
    });
    expect(state.sessions[0]).toMatchObject({
      state: "CLOSED",
      closeResponseJson: response,
    });
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(state.attachmentVersions).toHaveLength(1);
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_ZIP_MASTER_DISCARDED" })
    );
  });
});
