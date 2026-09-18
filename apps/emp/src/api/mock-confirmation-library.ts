import {
  ConfirmationInformationLibraryCreateInputSchema,
  ConfirmationInformationLibraryUpdateInputSchema,
} from "@project-wing/shared";

import type {
  api,
  ConfirmationGeneralLayout,
  ConfirmationInformationLibraryEntry,
} from "./client";
import {
  addLog,
  findProject,
  getCurrentUser,
  mockError,
  withState,
} from "./mock-store";
import type { MockState } from "./mock-types";

// Mirrors the API's default sections; kept in Mock state after the first edit.
const defaultLayout: ConfirmationGeneralLayout = {
  sections: [
    {
      id: "client",
      name: "客户名称",
      fields: [
        { id: "builtin-clientName", name: "客户名称", binding: "clientName" },
      ],
    },
    {
      id: "reference",
      name: "Ref",
      fields: [
        { id: "builtin-referenceCode", name: "Ref", binding: "referenceCode" },
      ],
    },
    {
      id: "bank",
      name: "客户银行与发函地址",
      fields: [
        { id: "builtin-bankName", name: "银行名称", binding: "bankName" },
        {
          id: "builtin-accountNumber",
          name: "银行账户",
          binding: "accountNumber",
        },
        {
          id: "builtin-recipientAddress",
          name: "发函地址",
          binding: "recipientAddress",
        },
      ],
    },
    {
      id: "general",
      name: "通用填写",
      fields: [
        { id: "builtin-officeDate", name: "事务所日期", binding: "officeDate" },
        { id: "builtin-picName", name: "PIC", binding: "picName" },
        { id: "builtin-micName", name: "MIC", binding: "micName" },
        { id: "builtin-reportDate", name: "报告日期", binding: "reportDate" },
      ],
    },
  ],
};
function requireManager(state: MockState) {
  if (getCurrentUser(state)?.globalRole !== "SUPER_ADMIN") {
    throw mockError("Only administrators can manage this library", "FORBIDDEN");
  }
}
function audit(state: MockState, action: string, targetId: string) {
  addLog(state, "confirmation-library", action, action, {
    targetType: "CONFIRMATION_INFORMATION_LIBRARY",
    targetId,
  });
}
function findEntry(state: MockState, id: string) {
  const entry = state.confirmationInformationLibrary?.find(
    (item) => item.id === id
  );
  if (!entry) {
    throw mockError("Information-library entry was not found");
  }
  return entry;
}
function present(
  entry: ConfirmationInformationLibraryEntry
): ConfirmationInformationLibraryEntry {
  const address = entry.mailingAddressSameAsBusiness
    ? entry.businessAddress
    : entry.mailingAddress;
  return {
    ...entry,
    effectiveMailingAddress: address || null,
    isReadyForDispatch: Boolean(address?.trim()),
  };
}
function setActive(id: string, active: boolean) {
  return withState((state) => {
    requireManager(state);
    const entry = findEntry(state, id);
    entry.isActive = active;
    entry.updatedAt = new Date().toISOString();
    audit(
      state,
      active
        ? "CONFIRMATION_INFORMATION_LIBRARY_RESTORED"
        : "CONFIRMATION_INFORMATION_LIBRARY_DEACTIVATED",
      id
    );
    return present(entry);
  });
}

export const mockConfirmationLibraryApi: Pick<
  typeof api,
  | "confirmationGeneralFields"
  | "confirmationGeneralLayout"
  | "updateConfirmationGeneralFields"
  | "updateConfirmationGeneralLayout"
  | "confirmationInformationLibrary"
  | "createConfirmationInformationLibrary"
  | "updateConfirmationInformationLibrary"
  | "deleteConfirmationInformationLibrary"
  | "restoreConfirmationInformationLibrary"
  | "projectConfirmationDefaults"
  | "updateProjectConfirmationDefaults"
> = {
  projectConfirmationDefaults: (projectId) =>
    withState((state) => {
      const project = findProject(state, projectId);
      const user = getCurrentUser(state);
      const member = project?.members?.find((item) => item.user.id === user.id);
      const office =
        user.globalRole === "SUPER_ADMIN" ||
        user.globalRole === "CONFIRMATION_OFFICER";
      if (
        !project ||
        (!office &&
          (!member ||
            member.authorizationSuspendedAt ||
            member.membershipStatus === "INVITED" ||
            !member.roleConsistent))
      ) {
        throw mockError(
          "Project does not exist or access is unavailable",
          "FORBIDDEN"
        );
      }
      return (
        state.confirmationDefaults?.[projectId] ?? {
          projectId,
          clientName: null,
          confirmationDate: null,
          reference: null,
          pic: null,
          mic: null,
          reportDate: null,
          baseInformation: null,
          updatedAt: null,
        }
      );
    }),
  updateProjectConfirmationDefaults: (projectId, input) =>
    withState((state) => {
      const project = findProject(state, projectId);
      const user = getCurrentUser(state);
      const member = project?.members?.find((item) => item.user.id === user.id);
      if (
        !project ||
        project.status !== "ACTIVE" ||
        user.globalRole === "SUPER_ADMIN" ||
        user.status !== "ACTIVE" ||
        !member ||
        member.membershipStatus === "INVITED" ||
        member.authorizationSuspendedAt ||
        !member.roleConsistent
      ) {
        throw mockError(
          "An authorized member of an active project is required",
          "FORBIDDEN"
        );
      }
      const existing = state.confirmationDefaults?.[projectId];
      const baseInformation =
        input.baseInformation === undefined
          ? (existing?.baseInformation ?? null)
          : input.baseInformation;
      if (
        baseInformation?.customFields?.some(
          (field) =>
            !state.confirmationGeneralFields?.some(
              (item) => item.id === field.id
            )
        )
      ) {
        throw mockError("Unknown custom field", "VALIDATION_FAILED");
      }
      const limits = {
        clientName: 500,
        confirmationDate: 80,
        reference: 200,
        pic: 200,
        mic: 200,
        reportDate: 80,
      };
      for (const [key, limit] of Object.entries(limits)) {
        const value = input[key as keyof typeof limits];
        if (typeof value === "string" && value.length > limit) {
          throw mockError("Invalid confirmation default", "VALIDATION_FAILED");
        }
      }
      const result = {
        projectId,
        clientName: input.clientName?.trim() || null,
        confirmationDate: input.confirmationDate?.trim() || null,
        reference: input.reference?.trim() || null,
        pic: input.pic?.trim() || null,
        mic: input.mic?.trim() || null,
        reportDate: input.reportDate?.trim() || null,
        baseInformation,
        updatedAt: new Date().toISOString(),
      };
      state.confirmationDefaults ??= {};
      state.confirmationDefaults[projectId] = result;
      addLog(
        state,
        projectId,
        "PROJECT_CONFIRMATION_DEFAULTS_UPDATED",
        "Updated confirmation defaults"
      );
      return result;
    }),
  confirmationGeneralFields: () =>
    withState((state) => state.confirmationGeneralFields ?? []),
  confirmationGeneralLayout: () =>
    withState((state) => state.confirmationGeneralLayout ?? defaultLayout),
  updateConfirmationGeneralFields: (fields) =>
    withState((state) => {
      requireManager(state);
      if (
        fields.length > 200 ||
        new Set(fields.map((field) => field.id)).size !== fields.length ||
        fields.some(
          (field) =>
            !/^[a-zA-Z0-9-]{1,80}$/.test(field.id) ||
            !field.name.trim() ||
            field.name.length > 100
        )
      ) {
        throw mockError(
          "Invalid general information fields",
          "VALIDATION_FAILED"
        );
      }
      state.confirmationGeneralFields = fields.map((field) => ({
        id: field.id,
        name: field.name.trim(),
      }));
      audit(state, "CONFIRMATION_GENERAL_FIELDS_UPDATED", "default");
      return state.confirmationGeneralFields;
    }),
  updateConfirmationGeneralLayout: (layout) =>
    withState((state) => {
      requireManager(state);
      const fields = layout.sections.flatMap((section) => section.fields);
      if (
        new Set(fields.map((field) => field.id)).size !== fields.length ||
        layout.sections.some(
          (section) => !section.id || !section.name.trim()
        ) ||
        fields.some(
          (field) =>
            !field.id ||
            !field.name.trim() ||
            (field.colSpan !== undefined &&
              field.colSpan !== 1 &&
              field.colSpan !== 2)
        )
      ) {
        throw mockError(
          "Invalid general information layout",
          "VALIDATION_FAILED"
        );
      }
      state.confirmationGeneralLayout = structuredClone(layout);
      state.confirmationGeneralFields = fields
        .filter((field) => !field.binding)
        .map(({ id, name }) => ({ id, name }));
      audit(state, "CONFIRMATION_GENERAL_FIELDS_LAYOUT_UPDATED", "default");
      return state.confirmationGeneralLayout;
    }),
  confirmationInformationLibrary: (input = {}) =>
    withState((state) => {
      const query = input.query?.trim().toLowerCase() ?? "";
      return (state.confirmationInformationLibrary ?? [])
        .filter(
          (entry) =>
            (input.includeInactive || entry.isActive) &&
            (input.entryId
              ? entry.id === input.entryId
              : !query ||
                [
                  entry.bankCode,
                  entry.bankNameEn,
                  entry.bankNameZh,
                  entry.businessAddress,
                  entry.mailingAddress,
                  entry.contactName,
                  entry.attention,
                ].some((value) => value?.toLowerCase().includes(query)))
        )
        .map(present);
    }),
  createConfirmationInformationLibrary: (input) =>
    withState((state) => {
      requireManager(state);
      const value =
        ConfirmationInformationLibraryCreateInputSchema.parse(input);
      state.confirmationInformationLibrary ??= [];
      const entries = state.confirmationInformationLibrary;
      if (entries.some((entry) => entry.bankCode === value.bankCode)) {
        throw mockError("Bank code already exists", "CONFLICT");
      }
      const now = new Date().toISOString();
      const entry = present({
        ...value,
        id: crypto.randomUUID(),
        sourceLabel: "MANUAL",
        sourceRow: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        effectiveMailingAddress: null,
        isReadyForDispatch: false,
      });
      entries.push(entry);
      audit(state, "CONFIRMATION_INFORMATION_LIBRARY_CREATED", entry.id);
      return entry;
    }),
  updateConfirmationInformationLibrary: (id, input) =>
    withState((state) => {
      requireManager(state);
      const value =
        ConfirmationInformationLibraryUpdateInputSchema.parse(input);
      const entry = findEntry(state, id);
      if (
        value.bankCode &&
        state.confirmationInformationLibrary?.some(
          (item) => item.id !== id && item.bankCode === value.bankCode
        )
      ) {
        throw mockError("Bank code already exists", "CONFLICT");
      }
      Object.assign(entry, value, { updatedAt: new Date().toISOString() });
      audit(state, "CONFIRMATION_INFORMATION_LIBRARY_UPDATED", id);
      return present(entry);
    }),
  deleteConfirmationInformationLibrary: (id) => setActive(id, false),
  restoreConfirmationInformationLibrary: (id) => setActive(id, true),
};
