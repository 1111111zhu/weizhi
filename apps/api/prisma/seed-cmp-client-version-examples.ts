import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { Prisma, User } from "@prisma/client";

import { buildAcceptanceChangeSummary } from "../src/cmp/acceptance-changes";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: assertPresentValue(process.env.DATABASE_URL),
  }),
});
const GROUP_CODE = "DEMO-VERSION-GROUP";

type VersionActor = Pick<User, "id" | "name">;
type DemoScenario =
  | "ADDRESS_AND_CONTACT"
  | "CORPORATE_AND_SERVICE"
  | "RELATIONSHIP_AND_REFERRAL";

type DemoClient = {
  sequence: "001" | "002" | "003";
  companyNumber: string;
  nameEn: string;
  nameZh: string;
  scenario: DemoScenario;
};

const DEMO_CLIENTS: DemoClient[] = [
  {
    sequence: "001",
    companyNumber: "7654321",
    nameEn: "Evergreen Retail Services Limited",
    nameZh: "长青零售服务有限公司",
    scenario: "ADDRESS_AND_CONTACT",
  },
  {
    sequence: "002",
    companyNumber: "7654322",
    nameEn: "Harbour Capital Advisory Limited",
    nameZh: "港湾资本顾问有限公司",
    scenario: "CORPORATE_AND_SERVICE",
  },
  {
    sequence: "003",
    companyNumber: "7654323",
    nameEn: "Northstar Technology Holdings Limited",
    nameZh: "北辰科技控股有限公司",
    scenario: "RELATIONSHIP_AND_REFERRAL",
  },
];

function clientCode(demo: DemoClient) {
  return `DEMO-VERSION-${demo.sequence}`;
}

function requestNo(demo: DemoClient, type: "CA" | "CC", version: 1 | 2 | 3) {
  return `${type}-VERSION-2026-${demo.sequence}-${version}`;
}

function requestNumbers(demo: DemoClient) {
  const current = [
    requestNo(demo, "CA", 1),
    requestNo(demo, "CC", 2),
    requestNo(demo, "CC", 3),
  ];
  return demo.sequence === "001"
    ? [
        ...current,
        "CA-VERSION-2026-001",
        "CC-VERSION-2026-002",
        "CC-VERSION-2026-003",
      ]
    : current;
}

function snapshot(
  demo: DemoClient,
  stage: 1 | 2 | 3,
  group: { id: string; groupCode: string }
) {
  const isAddressAndContact = demo.scenario === "ADDRESS_AND_CONTACT";
  const isCorporateAndService = demo.scenario === "CORPORATE_AND_SERVICE";
  const isRelationshipAndReferral =
    demo.scenario === "RELATIONSHIP_AND_REFERRAL";
  const changedAtVersionTwo = stage >= 2;
  const changedAtVersionThree = stage === 3;
  const current = {
    id: `demo-version-client-${demo.sequence}`,
    clientCode: clientCode(demo),
    companyNumber: demo.companyNumber,
    nameEn: demo.nameEn,
    nameZh: demo.nameZh,
    groupId: group.id,
    group: {
      id: group.id,
      groupCode: group.groupCode,
      nameEn: "Version History Demonstration Group",
      nameZh: "版本记录演示集团",
      status: "ACTIVE",
    },
    groupMode: "GROUP_MEMBER",
    groupName: "Version History Demonstration Group",
    status: "ACTIVE",
    yearEndMonth: 12,
    hsicSectionCode:
      isCorporateAndService && changedAtVersionTwo
        ? "J"
        : isRelationshipAndReferral && changedAtVersionThree
          ? "M"
          : "G",
    industryOtherDescription: null,
    reportingGaap: "HKFRS",
    placeOfIncorporation:
      isCorporateAndService && changedAtVersionTwo
        ? "Cayman Islands"
        : "Hong Kong",
    incorporationYearMonth:
      isCorporateAndService && changedAtVersionTwo ? "2016-06" : "2018-04",
    listedOrPrivate: "Private",
    registeredAddress: "18/F, 88 Harbour Road, Wan Chai, Hong Kong",
    principalBusinessAddress:
      isAddressAndContact && changedAtVersionTwo
        ? "Unit 1203, 12/F, Horizon Tower, Kwun Tong, Hong Kong"
        : "18/F, 88 Harbour Road, Wan Chai, Hong Kong",
    principalAddressSameAsRegistered: !(
      isAddressAndContact && changedAtVersionTwo
    ),
    additionalAddresses:
      isAddressAndContact && changedAtVersionThree
        ? [
            {
              id: `demo-version-address-${demo.sequence}`,
              type: "OTHER",
              label: "Shenzhen liaison office",
              address: "Tower B, Nanshan District, Shenzhen",
              sortOrder: 0,
            },
          ]
        : [],
    contactPerson:
      isAddressAndContact && changedAtVersionThree ? "Amy Wong" : "Alan Lee",
    contactPosition:
      isRelationshipAndReferral && changedAtVersionThree
        ? "Group Finance Controller"
        : "Finance Director",
    contactDepartment: "Finance",
    telephone: "+852 2765 4321",
    contactMobile:
      isAddressAndContact && changedAtVersionThree ? "+852 6123 4567" : null,
    email:
      isAddressAndContact && changedAtVersionThree
        ? `amy.wong@${clientCode(demo).toLowerCase()}.hk`
        : `alan.lee@${clientCode(demo).toLowerCase()}.hk`,
    website: `https://${clientCode(demo).toLowerCase()}.hk`,
    referredBy:
      isRelationshipAndReferral && changedAtVersionThree
        ? "Bank relationship manager"
        : "Audit referral network",
    clientPartnerPic:
      isRelationshipAndReferral && changedAtVersionTwo
        ? "Michael Tam"
        : "David Chan",
    clientManagerMic:
      isRelationshipAndReferral && changedAtVersionThree
        ? "Jony Ma"
        : "Karen Ho",
    expectedJobOrEngagementType:
      isCorporateAndService && changedAtVersionThree
        ? "Annual audit and review"
        : "Annual audit",
    serviceLines:
      isCorporateAndService && changedAtVersionTwo
        ? changedAtVersionThree
          ? "Annual Audit,Review"
          : "Annual Audit"
        : "Annual Audit",
    remarks:
      isAddressAndContact && changedAtVersionThree
        ? "Contact and operating address updated after digital commerce expansion."
        : isCorporateAndService && changedAtVersionThree
          ? "Incorporation, industry and expected service scope updated."
          : isRelationshipAndReferral && changedAtVersionThree
            ? "Client relationship contacts and referral source updated."
            : "Initial master data approved for annual audit opportunity.",
  };

  return current;
}

async function findActor(role: User["globalRole"], fallback?: VersionActor) {
  const user = await prisma.user.findFirst({
    where: { globalRole: role, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  if (user) {
    return user;
  }
  if (fallback) {
    return fallback;
  }
  throw new Error(`No active ${role} user is available for demo data.`);
}

async function main() {
  const [manager, partner, it] = await Promise.all([
    findActor("MANAGER"),
    findActor("PARTNER"),
    findActor("SUPER_ADMIN"),
  ]);
  const group = await prisma.cmpClientGroup.upsert({
    where: { groupCode: GROUP_CODE },
    create: {
      groupCode: GROUP_CODE,
      nameZh: "版本记录演示集团",
      nameEn: "Version History Demonstration Group",
      status: "ACTIVE",
      createdById: manager.id,
    },
    update: {
      nameZh: "版本记录演示集团",
      nameEn: "Version History Demonstration Group",
      status: "ACTIVE",
    },
    select: { id: true, groupCode: true },
  });

  for (const demo of DEMO_CLIENTS) {
    const versionOne = snapshot(demo, 1, group);
    const versionTwo = snapshot(demo, 2, group);
    const versionThree = snapshot(demo, 3, group);
    const client = await prisma.cmpClient.upsert({
      where: { clientCode: clientCode(demo) },
      create: {
        clientCode: clientCode(demo),
        companyNumber: versionThree.companyNumber,
        nameZh: versionThree.nameZh,
        nameEn: versionThree.nameEn,
        groupId: group.id,
        groupMode: versionThree.groupMode,
        groupName: versionThree.groupName,
        contactPerson: versionThree.contactPerson,
        contactPosition: versionThree.contactPosition,
        contactDepartment: versionThree.contactDepartment,
        telephone: versionThree.telephone,
        contactMobile: versionThree.contactMobile,
        email: versionThree.email,
        website: versionThree.website,
        yearEndMonth: versionThree.yearEndMonth,
        hsicSectionCode: versionThree.hsicSectionCode,
        industryOtherDescription: versionThree.industryOtherDescription,
        reportingGaap: versionThree.reportingGaap,
        placeOfIncorporation: versionThree.placeOfIncorporation,
        incorporationYearMonth: versionThree.incorporationYearMonth,
        listedOrPrivate: versionThree.listedOrPrivate,
        referredBy: versionThree.referredBy,
        clientPartnerPic: versionThree.clientPartnerPic,
        clientManagerMic: versionThree.clientManagerMic,
        expectedJobOrEngagementType: versionThree.expectedJobOrEngagementType,
        serviceLines: versionThree.serviceLines,
        remarks: versionThree.remarks,
        address: versionThree.principalBusinessAddress,
        principalAddressSameAsRegistered:
          versionThree.principalAddressSameAsRegistered,
        status: "ACTIVE",
        createdById: manager.id,
      },
      update: {
        companyNumber: versionThree.companyNumber,
        nameZh: versionThree.nameZh,
        nameEn: versionThree.nameEn,
        groupId: group.id,
        groupMode: versionThree.groupMode,
        groupName: versionThree.groupName,
        contactPerson: versionThree.contactPerson,
        contactPosition: versionThree.contactPosition,
        contactDepartment: versionThree.contactDepartment,
        telephone: versionThree.telephone,
        contactMobile: versionThree.contactMobile,
        email: versionThree.email,
        website: versionThree.website,
        yearEndMonth: versionThree.yearEndMonth,
        hsicSectionCode: versionThree.hsicSectionCode,
        industryOtherDescription: versionThree.industryOtherDescription,
        reportingGaap: versionThree.reportingGaap,
        placeOfIncorporation: versionThree.placeOfIncorporation,
        incorporationYearMonth: versionThree.incorporationYearMonth,
        listedOrPrivate: versionThree.listedOrPrivate,
        referredBy: versionThree.referredBy,
        clientPartnerPic: versionThree.clientPartnerPic,
        clientManagerMic: versionThree.clientManagerMic,
        expectedJobOrEngagementType: versionThree.expectedJobOrEngagementType,
        serviceLines: versionThree.serviceLines,
        remarks: versionThree.remarks,
        address: versionThree.principalBusinessAddress,
        principalAddressSameAsRegistered:
          versionThree.principalAddressSameAsRegistered,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.cmpClientVersion.deleteMany({ where: { clientId: client.id } });
      await tx.cmpAcceptanceRequest.deleteMany({
        where: {
          requestNo: {
            in: requestNumbers(demo),
          },
        },
      });
      await tx.cmpClientAddress.deleteMany({ where: { clientId: client.id } });
      await tx.cmpClientAddress.createMany({
        data: [
          {
            clientId: client.id,
            type: "REGISTERED",
            address: versionThree.registeredAddress,
            sortOrder: 0,
          },
          {
            clientId: client.id,
            type: "PRINCIPAL",
            address: versionThree.principalBusinessAddress,
            sortOrder: 0,
          },
          ...versionThree.additionalAddresses.map((address) => ({
            clientId: client.id,
            type: "OTHER" as const,
            label: address.label,
            address: address.address,
            sortOrder: address.sortOrder,
          })),
        ],
      });

      const requests = await Promise.all([
        tx.cmpAcceptanceRequest.create({
          data: {
            requestNo: requestNo(demo, "CA", 1),
            type: "CLIENT",
            status: "APPROVED",
            currentStep: "DONE",
            submittedById: manager.id,
            micApproverId: manager.id,
            picApproverId: partner.id,
            itApproverId: it.id,
            targetClientId: client.id,
            clientPayload: versionOne as Prisma.InputJsonValue,
            submittedAt: new Date("2026-04-08T09:30:00.000Z"),
            approvedAt: new Date("2026-04-10T08:15:00.000Z"),
          },
        }),
        tx.cmpAcceptanceRequest.create({
          data: {
            requestNo: requestNo(demo, "CC", 2),
            type: "CLIENT_CHANGE",
            status: "APPROVED",
            currentStep: "DONE",
            submittedById: manager.id,
            micApproverId: manager.id,
            picApproverId: partner.id,
            itApproverId: it.id,
            targetClientId: client.id,
            clientPayload: versionTwo as Prisma.InputJsonValue,
            changeBaselinePayload: versionOne as Prisma.InputJsonValue,
            submittedAt: new Date("2026-05-12T10:00:00.000Z"),
            approvedAt: new Date("2026-05-15T11:20:00.000Z"),
          },
        }),
        tx.cmpAcceptanceRequest.create({
          data: {
            requestNo: requestNo(demo, "CC", 3),
            type: "CLIENT_CHANGE",
            status: "APPROVED",
            currentStep: "DONE",
            submittedById: partner.id,
            micApproverId: manager.id,
            picApproverId: partner.id,
            itApproverId: it.id,
            targetClientId: client.id,
            clientPayload: versionThree as Prisma.InputJsonValue,
            changeBaselinePayload: versionTwo as Prisma.InputJsonValue,
            submittedAt: new Date("2026-06-18T09:00:00.000Z"),
            approvedAt: new Date("2026-06-20T14:35:00.000Z"),
          },
        }),
      ]);
      const [initial, addressChange, contactChange] = requests;
      await tx.cmpClientVersion.createMany({
        data: [
          {
            clientId: client.id,
            versionNumber: 1,
            sourceType: "CLIENT_ACCEPTANCE",
            acceptanceRequestId: initial.id,
            snapshotJson: versionOne as Prisma.InputJsonValue,
            changedById: manager.id,
            changedByName: manager.name,
            approvedById: it.id,
            approvedByName: it.name,
            approvedAt: initial.approvedAt,
          },
          {
            clientId: client.id,
            versionNumber: 2,
            sourceType: "CLIENT_CHANGE",
            acceptanceRequestId: addressChange.id,
            snapshotJson: versionTwo as Prisma.InputJsonValue,
            changeSummaryJson: buildAcceptanceChangeSummary({
              type: "CLIENT_CHANGE",
              baseline: versionOne,
              proposed: versionTwo,
              baselineCapturedAt: initial.approvedAt,
              staleMasterData: false,
            }) as Prisma.InputJsonValue,
            changedById: manager.id,
            changedByName: manager.name,
            approvedById: it.id,
            approvedByName: it.name,
            approvedAt: addressChange.approvedAt,
          },
          {
            clientId: client.id,
            versionNumber: 3,
            sourceType: "CLIENT_CHANGE",
            acceptanceRequestId: contactChange.id,
            snapshotJson: versionThree as Prisma.InputJsonValue,
            changeSummaryJson: buildAcceptanceChangeSummary({
              type: "CLIENT_CHANGE",
              baseline: versionTwo,
              proposed: versionThree,
              baselineCapturedAt: addressChange.approvedAt,
              staleMasterData: false,
            }) as Prisma.InputJsonValue,
            changedById: partner.id,
            changedByName: partner.name,
            approvedById: it.id,
            approvedByName: it.name,
            approvedAt: contactChange.approvedAt,
          },
        ],
      });
    });

    console.log(
      `Created ${clientCode(demo)} with v1-v3 client version history examples.`
    );
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
