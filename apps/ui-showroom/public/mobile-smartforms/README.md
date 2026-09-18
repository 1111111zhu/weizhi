# Imported SmartForm sample

`deferred-income.sf` is the unchanged authored SmartForm V2 definition from `packages/shared/src/smart-form-v2-fixtures.ts`, originally converted from the Deferred income worksheet in the audit-programme workbook. The adjacent response JSON is the matching repository response fixture, not a live engagement record.

`deferred-income.pdf` was produced by the API's existing `SmartFormV2PdfService` (compiler, Typst layout and PDF annotation pipeline), not by a mobile-only imitation. It is a read-only rendering snapshot. Regenerate after changing the definition, response, exporter or fonts:

```powershell
corepack pnpm --filter @project-wing/api exec tsx scripts/build-mobile-smartform-fixture.ts
```

No database, external API or production file is read or changed by this script. The mobile specimen lists this source separately under Deferred Income and does not send it to the synthetic three-row editor.
