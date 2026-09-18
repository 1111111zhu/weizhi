# Preserve PDF and Word colors in dark EMP previews

Removed automatic color inversion from the EMP PDF page render layers and cached PDF/Word raster images. PDF page backing and cached paper surfaces stay white. The direct Word renderer now keeps its document theme light and its page background white; application toolbar, surrounding canvas, and review cards still follow the application theme.

## Verification

- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/extend/docx-viewer.test.ts src/components/extend/pdf-viewer-layout.test.ts src/components/workbench-cached-preview.test.tsx`: 13 passed.
- `corepack pnpm --filter @project-wing/emp lint`: passed.
- Oxfmt formatted the modified preview files; `git diff --check` passed.
- Real browser, local mock EMP: `http://127.0.0.1:3033/zh-CN/engagement/project-orchid-2026`, Settings → Personalization → Dark; browser-native PDF viewer disabled. Opened Preview bank confirmation.pdf and Preview bank confirmation.docx from file actions → Preview.
- PDF measurement: root dark theme enabled, paper backing `rgb(255, 255, 255)`, render filters `blur(0.35px)` (existing base-render smoothing) and `none`, with no inversion. Screenshot showed white paper and original text within the dark viewer.
- Word measurement: root dark theme enabled, page background `rgb(255, 255, 255)`, filter `none`, and no night-reader wrapper. Screenshot showed white paper, black text, original red text and yellow highlighting.

The live backend-attached raster cache flow was not exercised in the browser; its existing targeted tests passed and its inversion class was removed. No production deployment or repository-wide test run was performed.
