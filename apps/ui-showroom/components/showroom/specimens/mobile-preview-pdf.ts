import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { mobileFiles, mobileProjects } from "./mobile-workspace-model";

/** Synthetic files for rendering acceptance only; never substitutes for a project API. */
export async function buildMobilePreviewPdf(projectId: string, fileId: string) {
  const project = mobileProjects.find((item) => item.id === projectId);
  const file = mobileFiles.find(
    (item) => item.id === fileId && item.kind === "PDF"
  );
  if (!project || !file) {
    throw new Error("No PDF source for this project/file");
  }
  const document = await PDFDocument.create();
  document.setTitle(`${project.code} / ${file.code} / ${file.name}`);
  document.setSubject("Synthetic mobile viewer acceptance document");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const title =
    file.id === "bank-reply" ? "Bank confirmation" : "December bank statement";
  const sections =
    file.id === "bank-reply"
      ? [
          [
            "Account information",
            "Account holder",
            project.client,
            "Account reference",
            "TEST-001",
            "Currency",
            "HKD",
            "Balance at 31 December 2026",
            "125,000.00",
          ],
          [
            "Additional information",
            "Facilities",
            "No facility in this test document",
            "Security",
            "No security in this test document",
            "Prepared for",
            project.client,
          ],
        ]
      : [
          [
            "Statement summary",
            "Account holder",
            project.client,
            "Period",
            "1 - 31 December 2026",
            "Opening balance",
            "120,000.00 HKD",
            "Closing balance",
            "125,000.00 HKD",
          ],
          [
            "Transaction details",
            "03 December - receipt",
            "+20,000.00 HKD",
            "12 December - payment",
            "-10,000.00 HKD",
            "22 December - payment",
            "-5,000.00 HKD",
          ],
        ];
  for (const [index, section] of sections.entries()) {
    const page = document.addPage([595.28, 841.89]);
    const text = (value: string, y: number, size = 12, strong = false) => {
      page.drawText(value, {
        x: 48,
        y,
        size,
        font: strong ? bold : regular,
        color: rgb(0.12, 0.12, 0.12),
        maxWidth: 499,
      });
    };
    text("SAMPLE DOCUMENT - NOT ISSUED BY A BANK", 794, 10);
    text(title, 738, 24, true);
    text(`${project.code} / ${file.code}`, 708);
    text(section[0] ?? "", 650, 16, true);
    let y = 600;
    for (let i = 1; i < section.length; i += 2) {
      text(section[i] ?? "", y, 10);
      text(section[i + 1] ?? "", y - 24, 14, true);
      page.drawLine({
        start: { x: 48, y: y - 42 },
        end: { x: 547, y: y - 42 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 88;
    }
    text("For viewer testing only. Not audit evidence.", 76, 10);
    text(`Page ${index + 1} of ${sections.length}`, 52, 10);
  }
  return document.save();
}
