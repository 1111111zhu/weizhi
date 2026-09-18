import "reflect-metadata";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
  SmartFormV2DefinitionSchema,
  SmartFormV2ResponseSchema,
} from "@project-wing/shared";

import { SmartFormV2PdfService } from "../src/smart-forms/smart-form-v2-pdf.service";

/** Build public showroom assets only. No application startup, database or remote writes. */
async function main() {
  const directory = new URL(
    "../../ui-showroom/public/mobile-smartforms/",
    import.meta.url
  );
  const definition = SmartFormV2DefinitionSchema.parse(
    DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
  );
  const response = SmartFormV2ResponseSchema.parse(
    DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
  );
  const pdf = await new SmartFormV2PdfService().renderSmartFormV2Pdf({
    definition,
    response,
    locale: "zh-CN",
    fileName: "审计程序——递延收入.sf",
    documentVersion: 1,
    generatedAt: "2026-09-10T00:00:00.000Z",
  });
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("deferred-income.sf", directory),
    JSON.stringify(definition, null, 2)
  );
  await writeFile(
    new URL("deferred-income.response.json", directory),
    JSON.stringify(response, null, 2)
  );
  await writeFile(new URL("deferred-income.pdf", directory), pdf);
  console.log(
    `SmartForm source, response and production-rendered PDF: ${fileURLToPath(directory)}`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
