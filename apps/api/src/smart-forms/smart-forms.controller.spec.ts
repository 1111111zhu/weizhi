import { DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE } from "@project-wing/shared";

import { SmartFormsController } from "./smart-forms.controller";

describe("smartFormsController SmartForm V2 PDF", () => {
  const smartForms = {
    getSmartFormV2PdfEngagementDetails: vi.fn(),
  };
  const pdf = {
    renderSmartFormV2Pdf: vi.fn(),
  };
  const user = { id: "user-1" } as never;
  let controller: SmartFormsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SmartFormsController(smartForms as never, pdf as never);
  });

  it("rejects a PDF request without projectId", async () => {
    await expect(
      controller.renderSmartFormV2Pdf(
        { definition: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE },
        user
      )
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_FAILED" },
    });
    expect(
      smartForms.getSmartFormV2PdfEngagementDetails
    ).not.toHaveBeenCalled();
    expect(pdf.renderSmartFormV2Pdf).not.toHaveBeenCalled();
  });

  it("loads the authenticated project's details before rendering", async () => {
    const engagementDetails = {
      clientName: "Client",
      engagementCode: "ENG-001",
      financialStatementDate: new Date("2026-03-31T00:00:00.000Z"),
    };
    const rendered = Buffer.from("%PDF-test");
    smartForms.getSmartFormV2PdfEngagementDetails.mockResolvedValue(
      engagementDetails
    );
    pdf.renderSmartFormV2Pdf.mockResolvedValue(rendered);

    await expect(
      controller.renderSmartFormV2Pdf(
        {
          projectId: "project-1",
          definition: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          locale: "en-US",
        },
        user
      )
    ).resolves.toBe(rendered);
    expect(smartForms.getSmartFormV2PdfEngagementDetails).toHaveBeenCalledWith(
      "project-1",
      user,
      "en-US"
    );
    expect(pdf.renderSmartFormV2Pdf).toHaveBeenCalledWith(
      expect.objectContaining({ engagementDetails })
    );
  });

  it("does not render when project membership validation fails", async () => {
    smartForms.getSmartFormV2PdfEngagementDetails.mockRejectedValue(
      new Error("not a member")
    );

    await expect(
      controller.renderSmartFormV2Pdf(
        {
          projectId: "project-1",
          definition: DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
        },
        user
      )
    ).rejects.toThrow("not a member");
    expect(pdf.renderSmartFormV2Pdf).not.toHaveBeenCalled();
  });
});
