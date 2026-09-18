import { z } from "zod";

const RequiredTextSchema = (max: number) => z.string().trim().min(1).max(max);
const NullableTextSchema = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => value?.trim() || null);

export const ConfirmationInformationLibraryBankCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/)
  .transform((value) => value.padStart(3, "0"));

const ConfirmationInformationLibraryInputFields = {
  bankCode: ConfirmationInformationLibraryBankCodeSchema,
  bankNameEn: RequiredTextSchema(300),
  bankNameZh: RequiredTextSchema(300),
  bankType: RequiredTextSchema(120),
  businessAddress: RequiredTextSchema(1000),
  mailingAddress: NullableTextSchema(1000),
  contactName: NullableTextSchema(500),
  attention: NullableTextSchema(500),
  notes: NullableTextSchema(2000),
  background: NullableTextSchema(2000),
  historicalMailingAddress: NullableTextSchema(1000),
  cautions: NullableTextSchema(2000),
  requiresBankTemplate: z.boolean().optional(),
};

export const ConfirmationInformationLibraryCreateInputSchema = z
  .object({
    ...ConfirmationInformationLibraryInputFields,
    mailingAddressSameAsBusiness: z.boolean().default(false),
  })
  .strict();
export type ConfirmationInformationLibraryCreateInput = z.infer<
  typeof ConfirmationInformationLibraryCreateInputSchema
>;

export const ConfirmationInformationLibraryUpdateInputSchema = z
  .object({
    bankCode: ConfirmationInformationLibraryBankCodeSchema.optional(),
    bankNameEn: RequiredTextSchema(300).optional(),
    bankNameZh: RequiredTextSchema(300).optional(),
    bankType: RequiredTextSchema(120).optional(),
    businessAddress: RequiredTextSchema(1000).optional(),
    mailingAddress: NullableTextSchema(1000).optional(),
    mailingAddressSameAsBusiness: z.boolean().optional(),
    contactName: NullableTextSchema(500).optional(),
    attention: NullableTextSchema(500).optional(),
    notes: NullableTextSchema(2000).optional(),
    background: NullableTextSchema(2000).optional(),
    historicalMailingAddress: NullableTextSchema(1000).optional(),
    cautions: NullableTextSchema(2000).optional(),
    requiresBankTemplate: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one information-library field is required",
  });
export type ConfirmationInformationLibraryUpdateInput = z.infer<
  typeof ConfirmationInformationLibraryUpdateInputSchema
>;

export const ConfirmationInformationLibraryEntrySchema = z.object({
  id: z.string().min(1),
  bankCode: z.string().regex(/^\d{3}$/),
  bankNameEn: z.string(),
  bankNameZh: z.string(),
  bankType: z.string(),
  businessAddress: z.string(),
  mailingAddress: z.string().nullable(),
  mailingAddressSameAsBusiness: z.boolean(),
  contactName: z.string().nullable(),
  attention: z.string().nullable(),
  notes: z.string().nullable(),
  background: z.string().nullable(),
  historicalMailingAddress: z.string().nullable().optional(),
  cautions: z.string().nullable().optional(),
  requiresBankTemplate: z.boolean().optional(),
  sourceLabel: z.string(),
  sourceRow: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  effectiveMailingAddress: z.string().nullable(),
  isReadyForDispatch: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ConfirmationInformationLibraryEntry = z.infer<
  typeof ConfirmationInformationLibraryEntrySchema
>;
