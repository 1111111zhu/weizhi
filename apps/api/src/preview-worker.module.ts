import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { backgroundScheduleOptions } from "./common/background-jobs";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { AttachmentPreviewWorkerService } from "./workflow/attachment-preview-worker.service";
import { DocumentConversionService } from "./workflow/document-conversion.service";
import { PdfRasterPreviewService } from "./workflow/pdf-raster-preview.service";
import { SpreadsheetPreviewCacheService } from "./workflow/spreadsheet-preview-cache.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        ".env.local",
        ".env",
        "apps/api/.env.local",
        "apps/api/.env",
      ],
    }),
    ScheduleModule.forRootAsync({ useFactory: backgroundScheduleOptions }),
    PrismaModule,
    StorageModule,
  ],
  providers: [
    DocumentConversionService,
    PdfRasterPreviewService,
    SpreadsheetPreviewCacheService,
    AttachmentPreviewWorkerService,
  ],
})
export class PreviewWorkerModule {
  private readonly _moduleMarker = true;
}
