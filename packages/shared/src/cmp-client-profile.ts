import { z } from "zod";

import { CmpCompanyIdentityResolutionSchema } from "./cmp-entity-graph.js";
import {
  CmpClientAdditionalAddressInputSchema,
  CmpClientContactInputSchema,
  CmpClientContactSchema,
  CmpCompanyIdentifierTypeSchema,
} from "./index.js";

const OptionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).optional();
const OptionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional();
const OptionalYearMonth = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
  .optional();

export const CmpClientProfileStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type CmpClientProfileStatus = z.infer<
  typeof CmpClientProfileStatusSchema
>;

export const CreateCmpClientProfileSchema = z
  .object({
    clientCode: z.string().trim().min(1).max(50),
    companyCode: OptionalText(100),
    companyIdentifierType: CmpCompanyIdentifierTypeSchema.optional(),
    companyIdentityResolution: CmpCompanyIdentityResolutionSchema.optional(),
    status: CmpClientProfileStatusSchema.optional().default("ACTIVE"),
    nameEn: OptionalText(200),
    nameZh: OptionalText(200),
    companyNumber: OptionalText(100),
    jurisdiction: OptionalText(200),
    incorporationYearMonth: OptionalYearMonth,
    yearEndDate: OptionalDate,
    yearEndMonth: z.number().int().min(1).max(12).optional(),
    hsicSectionCode: z
      .string()
      .trim()
      .regex(/^(?:[A-U]|OTHER)$/)
      .optional(),
    industryOtherDescription: OptionalText(2000),
    reportingGaap: OptionalText(500),
    address: OptionalText(1000),
    registeredAddress: OptionalText(2000),
    principalBusinessAddress: OptionalText(2000),
    principalAddressSameAsRegistered: z.boolean().optional(),
    additionalAddresses: z
      .array(CmpClientAdditionalAddressInputSchema)
      .optional(),
    contactPerson: OptionalText(200),
    telephone: OptionalText(100),
    contactPosition: OptionalText(200),
    contactDepartment: OptionalText(200),
    contactMobile: OptionalText(100),
    contactRemarks: OptionalText(2000),
    contacts: z.array(CmpClientContactInputSchema).max(50).optional(),
    email: z.string().trim().email().max(320).optional(),
    website: OptionalText(500),
    referredBy: OptionalText(200),
    clientLeadingPartnerId: OptionalText(100),
    clientPartnerPicId: OptionalText(100),
    clientManagerMicId: OptionalText(100),
    alternativePartnerSecondMicId: OptionalText(100),
    remarks: OptionalText(2000),
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.nameEn && !input.nameZh) {
      context.addIssue({
        code: "custom",
        message: "At least one client name is required",
        path: ["nameEn"],
      });
    }
    if (input.hsicSectionCode === "OTHER" && !input.industryOtherDescription) {
      context.addIssue({
        code: "custom",
        message: "Other Industry Description is required",
        path: ["industryOtherDescription"],
      });
    }
  });
export type CreateCmpClientProfileInput = z.infer<
  typeof CreateCmpClientProfileSchema
>;

export const CmpClientProfileSchema = z.object({
  id: z.string(),
  clientCode: z.string(),
  companyCode: z.string().nullable().optional(),
  companyIdentifierType: CmpCompanyIdentifierTypeSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "RESIGNED"]),
  nameEn: z.string().nullable(),
  nameZh: z.string().nullable(),
  companyNumber: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  incorporationYearMonth: z.string().nullable(),
  yearEndDate: z.string().nullable(),
  yearEndMonth: z.number().int().min(1).max(12).nullable(),
  hsicSectionCode: z.string().nullable(),
  industryOtherDescription: z.string().nullable(),
  reportingGaap: z.string().nullable(),
  address: z.string().nullable(),
  registeredAddress: z.string().nullable(),
  principalBusinessAddress: z.string().nullable(),
  principalAddressSameAsRegistered: z.boolean(),
  additionalAddresses: z.array(
    z.object({
      id: z.string(),
      label: z.string().nullable(),
      address: z.string(),
      sortOrder: z.number().int(),
    })
  ),
  contactPerson: z.string().nullable(),
  telephone: z.string().nullable(),
  contactPosition: z.string().nullable(),
  contactDepartment: z.string().nullable(),
  contactMobile: z.string().nullable(),
  contactRemarks: z.string().nullable(),
  contacts: z.array(CmpClientContactSchema).optional(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  referredBy: z.string().nullable(),
  clientLeadingPartnerId: z.string().nullable(),
  clientLeadingPartner: z.string().nullable(),
  clientPartnerPicId: z.string().nullable(),
  clientPartnerPic: z.string().nullable(),
  clientManagerMicId: z.string().nullable(),
  clientManagerMic: z.string().nullable(),
  alternativePartnerSecondMicId: z.string().nullable(),
  alternativePartnerSecondMic: z.string().nullable(),
  remarks: z.string().nullable(),
  rootEntity: z
    .object({
      id: z.string(),
      kind: z.literal("COMPANY"),
      displayName: z.string(),
      jurisdiction: z.string().nullable(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CmpClientProfile = z.infer<typeof CmpClientProfileSchema>;
