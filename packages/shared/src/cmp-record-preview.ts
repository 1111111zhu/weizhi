import { z } from "zod";

export const CmpRecordPreviewLocaleSchema = z.enum(["en-US", "zh-CN"]);
export type CmpRecordPreviewLocale = z.infer<
  typeof CmpRecordPreviewLocaleSchema
>;

export const CmpRecordPreviewQuerySchema = z
  .object({
    locale: CmpRecordPreviewLocaleSchema.optional().default("en-US"),
  })
  .strict();
export type CmpRecordPreviewQuery = z.infer<typeof CmpRecordPreviewQuerySchema>;

export const CmpRecordPreviewFieldSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.string(),
  })
  .strict();
export type CmpRecordPreviewField = z.infer<typeof CmpRecordPreviewFieldSchema>;

export const CmpRecordPreviewTableSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
    rows: z.array(z.array(z.string())),
    footer: z.array(z.string()).optional(),
  })
  .strict();
export type CmpRecordPreviewTable = z.infer<typeof CmpRecordPreviewTableSchema>;

export const CmpRecordPreviewSectionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    fields: z.array(CmpRecordPreviewFieldSchema),
    tables: z.array(CmpRecordPreviewTableSchema).optional(),
  })
  .strict();
export type CmpRecordPreviewSection = z.infer<
  typeof CmpRecordPreviewSectionSchema
>;

export const CmpRecordPreviewDocumentSchema = z
  .object({
    kind: z.enum(["CLIENT", "ENGAGEMENT"]),
    recordId: z.string().min(1),
    code: z.string().min(1),
    title: z.string().min(1),
    status: z.string().min(1),
    updatedAt: z.string().datetime(),
    sections: z.array(CmpRecordPreviewSectionSchema).min(1),
  })
  .strict();
export type CmpRecordPreviewDocument = z.infer<
  typeof CmpRecordPreviewDocumentSchema
>;
