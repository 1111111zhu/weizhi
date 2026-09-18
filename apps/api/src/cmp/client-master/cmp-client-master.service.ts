import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CmpClientProfileSchema } from "@project-wing/shared/cmp-client-profile";
import type { CreateCmpClientProfileInput } from "@project-wing/shared/cmp-client-profile";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { RequestUser } from "../../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../../common/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ensureCmpClientRootEntity } from "../entity-graph/cmp-entity-graph.service";

const CLIENT_PROFILE_SELECT = Prisma.validator<Prisma.CmpClientSelect>()({
  id: true,
  clientCode: true,
  companyCode: true,
  status: true,
  nameEn: true,
  nameZh: true,
  companyIdentifierType: true,
  companyNumber: true,
  placeOfIncorporation: true,
  incorporationYearMonth: true,
  yearEndDate: true,
  yearEndMonth: true,
  hsicSectionCode: true,
  industryOtherDescription: true,
  reportingGaap: true,
  address: true,
  principalAddressSameAsRegistered: true,
  addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
  contacts: { orderBy: { sortOrder: "asc" } },
  contactPerson: true,
  telephone: true,
  contactPosition: true,
  contactDepartment: true,
  contactMobile: true,
  contactRemarks: true,
  email: true,
  website: true,
  referredBy: true,
  clientLeadingPartnerId: true,
  clientLeadingPartner: true,
  clientPartnerPicId: true,
  clientPartnerPic: true,
  clientManagerMicId: true,
  clientManagerMic: true,
  alternativePartnerSecondMicId: true,
  alternativePartnerSecondMic: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
});
const CLIENT_MASTER_CREATE_ROLES = new Set([
  "SUPER_ADMIN",
  "PARTNER",
  "PRINCIPAL",
  "MANAGER",
]);

@Injectable()
export class CmpClientMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async createClientProfile(
    input: CreateCmpClientProfileInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    assertCanCreateClientProfile(user);

    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const duplicateCode = await tx.cmpClient.findUnique({
          where: { clientCode: input.clientCode },
          select: { id: true },
        });
        if (duplicateCode) {
          throw new ApiConflictException(
            "DUPLICATE_CODE",
            "Client code already exists"
          );
        }
        const companyCode = normalizeOptional(input.companyCode);
        if (companyCode) {
          const duplicateCompanyCode = await tx.cmpClient.findFirst({
            where: {
              companyCode: { equals: companyCode, mode: "insensitive" },
            },
            select: { id: true },
          });
          if (duplicateCompanyCode) {
            throw new ApiConflictException(
              "DUPLICATE_CODE",
              "Company Code already exists"
            );
          }
        }

        const responsibleUsers = await resolveResponsibleUsers(tx, input);
        const contacts = normalizeProfileContacts(input);
        const [primaryContact] = contacts;
        const client = await tx.cmpClient.create({
          data: {
            clientCode: input.clientCode,
            companyCode,
            status: input.status,
            nameEn: normalizeOptional(input.nameEn),
            nameZh: normalizeOptional(input.nameZh),
            companyIdentifierType:
              input.companyIdentifierType ?? "COMPANY_REGISTRATION_NUMBER",
            companyNumber: normalizeOptional(input.companyNumber),
            placeOfIncorporation: normalizeOptional(input.jurisdiction),
            incorporationYearMonth: normalizeOptional(
              input.incorporationYearMonth
            ),
            yearEndDate: normalizeOptionalDate(input.yearEndDate),
            yearEndMonth: input.yearEndMonth ?? null,
            hsicSectionCode: normalizeOptional(input.hsicSectionCode),
            industryOtherDescription:
              input.hsicSectionCode === "OTHER"
                ? normalizeOptional(input.industryOtherDescription)
                : null,
            reportingGaap: normalizeOptional(input.reportingGaap),
            address: normalizeOptional(
              input.registeredAddress ?? input.address
            ),
            principalAddressSameAsRegistered:
              input.principalAddressSameAsRegistered ?? false,
            addresses: {
              create: buildProfileAddresses(input),
            },
            contactPerson:
              primaryContact?.name ?? normalizeOptional(input.contactPerson),
            telephone:
              primaryContact?.officePhone ?? normalizeOptional(input.telephone),
            contactPosition:
              primaryContact?.position ??
              normalizeOptional(input.contactPosition),
            contactDepartment:
              primaryContact?.department ??
              normalizeOptional(input.contactDepartment),
            contactMobile:
              primaryContact?.mobile ?? normalizeOptional(input.contactMobile),
            contactRemarks:
              primaryContact?.remarks ??
              normalizeOptional(input.contactRemarks),
            email: primaryContact?.email ?? normalizeOptional(input.email),
            contacts:
              contacts.length > 0
                ? { create: contacts.map(profileContactCreateData) }
                : undefined,
            website: normalizeOptional(input.website),
            referredBy: normalizeOptional(input.referredBy),
            clientLeadingPartnerId: normalizeOptional(
              input.clientLeadingPartnerId
            ),
            clientLeadingPartner: responsibleUsers.clientLeadingPartner,
            clientPartnerPicId: normalizeOptional(input.clientPartnerPicId),
            clientPartnerPic: responsibleUsers.clientPartnerPic,
            clientManagerMicId: normalizeOptional(input.clientManagerMicId),
            clientManagerMic: responsibleUsers.clientManagerMic,
            alternativePartnerSecondMicId: normalizeOptional(
              input.alternativePartnerSecondMicId
            ),
            alternativePartnerSecondMic:
              responsibleUsers.alternativePartnerSecondMic,
            remarks: normalizeOptional(input.remarks),
            createdById: user.id,
          },
          select: CLIENT_PROFILE_SELECT,
        });

        await ensureCmpClientRootEntity(tx, client.id, {
          clientCode: input.clientCode,
          companyIdentifierType: input.companyIdentifierType,
          companyIdentityResolution: input.companyIdentityResolution,
          companyNumber: input.companyNumber,
          nameEn: input.nameEn,
          nameZh: input.nameZh,
          placeOfIncorporation: input.jurisdiction,
          listedOrPrivate: "OTHER",
          registeredAddress: input.registeredAddress,
          address: input.address,
          principalBusinessAddress: input.principalBusinessAddress,
        });

        return this.formatClientProfile(tx, client);
      });

      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_CLIENT_MASTER_CREATED",
        targetType: "CMP_CLIENT",
        targetId: profile.id,
        description: `Created CMP client master ${profile.clientCode}`,
        source,
      });

      return profile;
    } catch (error) {
      if (error instanceof ApiConflictException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiConflictException(
          "DUPLICATE_CODE",
          "Client code or company identity already exists"
        );
      }
      throw error;
    }
  }

  async getClientProfile(id: string) {
    const client = await this.prisma.cmpClient.findUnique({
      where: { id },
      select: CLIENT_PROFILE_SELECT,
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    return this.formatClientProfile(this.prisma, client);
  }

  private async formatClientProfile(
    tx: Pick<PrismaService, "cmpClientEntityScope">,
    client: {
      id: string;
      clientCode: string;
      companyCode: string | null;
      status: string;
      nameEn: string | null;
      nameZh: string | null;
      companyIdentifierType: string;
      companyNumber: string | null;
      placeOfIncorporation: string | null;
      incorporationYearMonth: string | null;
      yearEndDate: Date | null;
      yearEndMonth: number | null;
      hsicSectionCode: string | null;
      industryOtherDescription: string | null;
      reportingGaap: string | null;
      address: string | null;
      principalAddressSameAsRegistered: boolean;
      addresses: {
        id: string;
        type: "REGISTERED" | "PRINCIPAL" | "OTHER";
        label: string | null;
        address: string;
        sortOrder: number;
      }[];
      contacts: {
        id: string;
        name: string | null;
        position: string | null;
        department: string | null;
        officePhone: string | null;
        mobile: string | null;
        email: string | null;
        remarks: string | null;
        sortOrder: number;
      }[];
      contactPerson: string | null;
      telephone: string | null;
      contactPosition: string | null;
      contactDepartment: string | null;
      contactMobile: string | null;
      contactRemarks: string | null;
      email: string | null;
      website: string | null;
      referredBy: string | null;
      clientLeadingPartnerId: string | null;
      clientLeadingPartner: string | null;
      clientPartnerPicId: string | null;
      clientPartnerPic: string | null;
      clientManagerMicId: string | null;
      clientManagerMic: string | null;
      alternativePartnerSecondMicId: string | null;
      alternativePartnerSecondMic: string | null;
      remarks: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  ) {
    const addresses = client.addresses ?? [];
    const rootScope = await tx.cmpClientEntityScope.findFirst({
      where: { clientId: client.id, role: "ROOT" },
      include: { entity: true },
    });

    return CmpClientProfileSchema.parse({
      id: client.id,
      clientCode: client.clientCode,
      companyCode: client.companyCode,
      status: client.status,
      nameEn: client.nameEn,
      nameZh: client.nameZh,
      companyNumber: client.companyNumber,
      companyIdentifierType: client.companyIdentifierType,
      jurisdiction: client.placeOfIncorporation ?? null,
      incorporationYearMonth: client.incorporationYearMonth ?? null,
      yearEndDate: client.yearEndDate?.toISOString().slice(0, 10) ?? null,
      yearEndMonth: client.yearEndMonth ?? null,
      hsicSectionCode: client.hsicSectionCode ?? null,
      industryOtherDescription: client.industryOtherDescription ?? null,
      reportingGaap: client.reportingGaap ?? null,
      address: client.address,
      registeredAddress:
        addresses.find((address) => address.type === "REGISTERED")?.address ??
        client.address,
      principalBusinessAddress:
        addresses.find((address) => address.type === "PRINCIPAL")?.address ??
        client.address,
      principalAddressSameAsRegistered:
        client.principalAddressSameAsRegistered ?? false,
      additionalAddresses: addresses
        .filter((address) => address.type === "OTHER")
        .map((address) => ({
          id: address.id,
          label: address.label,
          address: address.address,
          sortOrder: address.sortOrder,
        })),
      contactPerson: client.contactPerson,
      telephone: client.telephone,
      contactPosition: client.contactPosition ?? null,
      contactDepartment: client.contactDepartment ?? null,
      contactMobile: client.contactMobile ?? null,
      contactRemarks: client.contactRemarks ?? null,
      contacts: (client.contacts ?? []).map((contact) => ({
        id: contact.id,
        name: contact.name,
        position: contact.position,
        department: contact.department,
        officePhone: contact.officePhone,
        mobile: contact.mobile,
        email: contact.email,
        remarks: contact.remarks,
        sortOrder: contact.sortOrder,
      })),
      email: client.email,
      website: client.website,
      referredBy: client.referredBy,
      clientLeadingPartnerId: client.clientLeadingPartnerId ?? null,
      clientLeadingPartner: client.clientLeadingPartner ?? null,
      clientPartnerPicId: client.clientPartnerPicId,
      clientPartnerPic: client.clientPartnerPic,
      clientManagerMicId: client.clientManagerMicId,
      clientManagerMic: client.clientManagerMic,
      alternativePartnerSecondMicId: client.alternativePartnerSecondMicId,
      alternativePartnerSecondMic: client.alternativePartnerSecondMic,
      remarks: client.remarks,
      rootEntity: rootScope
        ? {
            id: rootScope.entity.id,
            kind: rootScope.entity.kind,
            displayName: rootScope.entity.displayName,
            jurisdiction: rootScope.entity.jurisdiction,
            registrationNumber: rootScope.entity.registrationNumber,
          }
        : null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    });
  }
}

function normalizeProfileContacts(input: CreateCmpClientProfileInput) {
  const source =
    input.contacts === undefined
      ? [
          {
            name: input.contactPerson,
            position: input.contactPosition,
            department: input.contactDepartment,
            officePhone: input.telephone,
            mobile: input.contactMobile,
            email: input.email,
            remarks: input.contactRemarks,
          },
        ]
      : input.contacts;
  return source.flatMap((contact, index) => {
    const normalized = {
      name: normalizeOptional(contact.name),
      position: normalizeOptional(contact.position),
      department: normalizeOptional(contact.department),
      officePhone: normalizeOptional(contact.officePhone),
      mobile: normalizeOptional(contact.mobile),
      email: normalizeOptional(contact.email),
      remarks: normalizeOptional(contact.remarks),
      sortOrder: contact.sortOrder ?? index,
    };
    return Object.values(normalized).some(
      (value) => typeof value === "string" && Boolean(value)
    )
      ? [normalized]
      : [];
  });
}

function profileContactCreateData(
  contact: ReturnType<typeof normalizeProfileContacts>[number]
) {
  return contact;
}

async function resolveResponsibleUsers(
  tx: Pick<Prisma.TransactionClient, "user">,
  input: CreateCmpClientProfileInput
) {
  const ids = [
    input.clientLeadingPartnerId,
    input.clientPartnerPicId,
    input.clientManagerMicId,
    input.alternativePartnerSecondMicId,
  ].filter((id): id is string => Boolean(normalizeOptional(id)));
  if (ids.length === 0) {
    return {
      clientPartnerPic: null,
      clientLeadingPartner: null,
      clientManagerMic: null,
      alternativePartnerSecondMic: null,
    };
  }

  const users = await tx.user.findMany({
    where: { id: { in: [...new Set(ids)] }, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  const usersById = new Map(users.map((item) => [item.id, item.name]));
  const missingId = ids.find((id) => !usersById.has(id));
  if (missingId) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A selected responsible person is unavailable"
    );
  }

  return {
    clientLeadingPartner: input.clientLeadingPartnerId
      ? (usersById.get(input.clientLeadingPartnerId) ?? null)
      : null,
    clientPartnerPic: input.clientPartnerPicId
      ? (usersById.get(input.clientPartnerPicId) ?? null)
      : null,
    clientManagerMic: input.clientManagerMicId
      ? (usersById.get(input.clientManagerMicId) ?? null)
      : null,
    alternativePartnerSecondMic: input.alternativePartnerSecondMicId
      ? (usersById.get(input.alternativePartnerSecondMicId) ?? null)
      : null,
  };
}

function assertCanCreateClientProfile(user: RequestUser) {
  if (!CLIENT_MASTER_CREATE_ROLES.has(user.globalRole)) {
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Your role cannot create Client master records"
    );
  }
}

function buildProfileAddresses(input: CreateCmpClientProfileInput) {
  const registered = normalizeOptional(
    input.registeredAddress ?? input.address
  );
  const principal = normalizeOptional(
    input.principalAddressSameAsRegistered
      ? (input.registeredAddress ?? input.address)
      : input.principalBusinessAddress
  );
  return [
    ...(registered
      ? [
          {
            type: "REGISTERED" as const,
            label: "Registered address",
            address: registered,
            sortOrder: 0,
          },
        ]
      : []),
    ...(principal
      ? [
          {
            type: "PRINCIPAL" as const,
            label: "Principal business address",
            address: principal,
            sortOrder: 0,
          },
        ]
      : []),
    ...(input.additionalAddresses ?? []).flatMap((address, index) => {
      const label = normalizeOptional(address.label);
      const value = normalizeOptional(address.address);
      return label && value
        ? [
            {
              type: "OTHER" as const,
              label,
              address: value,
              sortOrder: address.sortOrder ?? index,
            },
          ]
        : [];
    }),
  ];
}

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeOptionalDate(value?: string | null) {
  const normalized = normalizeOptional(value);
  return normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
}
