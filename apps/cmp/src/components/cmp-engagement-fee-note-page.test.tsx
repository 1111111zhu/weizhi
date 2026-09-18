import type { CmpEngagementFeeNote } from "@project-wing/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CmpI18nProvider } from "@/i18n/client";

import { FeeNoteDocument } from "./cmp-engagement-fee-note-page";

const note: CmpEngagementFeeNote = {
  id: null,
  engagementId: "engagement-1",
  periodNumber: 1,
  plannedIssueDate: "2025-08-01",
  plannedAmount: "139900.00",
  receivedAmount: "",
  receivedDate: "",
  collectionStatus: "UNRECORDED",
  outstandingAmount: "139900.00",
  feeNoteNumber: "28505",
  engagementReference: "H247AUP202412010001",
  issueDate: "2025-08-25",
  recipientName: "Harbour Investments Limited",
  recipientAttention: "Director",
  recipientSalutation: "Your company",
  recipientAddress: "89 Golden Road\nHong Kong",
  currency: "HKD",
  serviceDescription: "Audit services for the year ended 31 December 2024",
  lineItems: [
    {
      id: "service-fee",
      description: "Final service fee",
      amount: "138000.00",
    },
    {
      id: "disbursements",
      description: "Disbursements",
      amount: "1900.00",
    },
  ],
  amount: "138000.00",
  disbursementAmount: "1900.00",
  totalAmount: "139900.00",
  issuerReference: "JMZ/JKCP",
  signatoryName: "Jane Manager",
  bankPayeeName: "",
  bankPayeeNameZh: "",
  bankName: "",
  hkdAccountNumber: "",
  cnyAccountNumber: "",
  usdAccountNumber: "",
  swiftCode: "",
  hkdSwiftCode: "",
  cnySwiftCode: "",
  usdSwiftCode: "",
  firmLegalName: "维致（香港）会计师事务所 / Wing Zenith",
  firmAddress:
    "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong\n香港灣仔駱克道193號東超商業中心17樓1703至1704室",
  firmPhone: "Tel: (852) 53667568",
  firmFax: "",
  firmEmail: "info@wzcpa.hk",
  firmWebsite: "www.wzcpa.hk",
  localizedContent: {
    "zh-CN": {
      recipientName: "Harbour Investments Limited",
      recipientAttention: "Director",
      recipientSalutation: "Your company",
      recipientAddress: "89 Golden Road\nHong Kong",
      serviceDescription: "Audit services for the year ended 31 December 2024",
      lineItemDescriptions: {
        "service-fee": "Final service fee",
        disbursements: "Disbursements",
      },
      signatoryName: "Jane Manager",
      bankPayeeName: "",
      bankName: "",
      firmLegalName: "维致（香港）会计师事务所 / Wing Zenith",
      firmAddress:
        "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong\n香港灣仔駱克道193號東超商業中心17樓1703至1704室",
    },
    "en-US": {
      recipientName: "Harbour Investments Limited",
      recipientAttention: "Director",
      recipientSalutation: "Your company",
      recipientAddress: "89 Golden Road\nHong Kong",
      serviceDescription: "Audit services for the year ended 31 December 2024",
      lineItemDescriptions: {
        "service-fee": "Final service fee",
        disbursements: "Disbursements",
      },
      signatoryName: "Jane Manager",
      bankPayeeName: "",
      bankName: "",
      firmLegalName: "维致（香港）会计师事务所 / Wing Zenith",
      firmAddress:
        "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong\n香港灣仔駱克道193號東超商業中心17樓1703至1704室",
    },
  },
  createdAt: null,
  updatedAt: null,
};

describe(FeeNoteDocument, () => {
  it("uses its local document language without changing the CMP language provider", () => {
    const bilingualNote = {
      ...note,
      localizedContent: {
        ...note.localizedContent,
        "zh-CN": {
          ...note.localizedContent["zh-CN"],
          recipientName: "中文客户",
          serviceDescription: "中文专业服务",
        },
        "en-US": {
          ...note.localizedContent["en-US"],
          recipientName: "English Client",
          serviceDescription: "English professional services",
        },
      },
    };
    render(
      <CmpI18nProvider initialLocale="zh-CN">
        <FeeNoteDocument locale="en-US" note={bilingualNote} update={vi.fn()} />
      </CmpI18nProvider>
    );

    expect(screen.getAllByLabelText("Fee note number")).toHaveLength(2);
    expect(
      screen.getByRole("region", { name: "Service item" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("English Client")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("中文客户")).not.toBeInTheDocument();
  });

  it("renders the visible fee note fields as an editable document", () => {
    render(
      <CmpI18nProvider initialLocale="en-US">
        <FeeNoteDocument note={note} update={vi.fn()} />
      </CmpI18nProvider>
    );

    expect(screen.getAllByDisplayValue("28505")).toHaveLength(2);
    expect(screen.getByDisplayValue("H247AUP202412010001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2025-08-25")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Harbour Investments Limited")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Recipient address/i })
    ).toHaveValue("89 Golden Road\nHong Kong");
    expect(screen.getByDisplayValue("Director")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Professional services")
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Final service fee")).toBeInTheDocument();
    expect(screen.getByDisplayValue("138000.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Disbursements")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1900.00")).toBeInTheDocument();
    expect(screen.getByText(/139,900\.00/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add service item/i })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jane Manager")).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("787-800014-001")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("信永中和（香港）會計師事務所有限公司")
    ).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("SWIFT code")).toHaveLength(3);
    expect(screen.getByDisplayValue("Tel: (852) 53667568")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fax")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("www.wzcpa.hk")).toBeInTheDocument();
    expect(screen.getByTestId("cmp-fee-note-document")).toHaveClass(
      "cmp-fee-note-document"
    );
    expect(screen.getByTestId("cmp-fee-note-document")).toHaveClass(
      "min-h-[48rem]"
    );
    expect(screen.getByTestId("cmp-fee-note-document")).toHaveClass(
      "print:px-[7mm]"
    );
    expect(screen.getByTestId("cmp-fee-note-remittance")).toHaveClass("mt-10");
    expect(screen.getByTestId("cmp-fee-note-remittance")).not.toHaveClass(
      "mt-auto"
    );
    expect(
      screen.getByRole("button", { name: /add service item/i })
    ).toHaveClass("print:!hidden");
    expect(screen.getByDisplayValue("Final service fee")).toHaveClass(
      "print:border-0"
    );
    expect(screen.getByTestId("cmp-fee-note-total")).toHaveClass("border-b-4");
    expect(screen.getByTestId("cmp-fee-note-remittance-divider")).toHaveClass(
      "border-dashed"
    );
  });

  it("uses a reusable Fee Note template without a scanned document or blue annotations", () => {
    render(
      <CmpI18nProvider initialLocale="en-US">
        <FeeNoteDocument note={note} update={vi.fn()} />
      </CmpI18nProvider>
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByLabelText("WZ")).toBeInTheDocument();
    expect(screen.queryByText("Firm default")).not.toBeInTheDocument();
    expect(screen.queryByText("Engagement")).not.toBeInTheDocument();
  });

  it("adds a configurable service item and keeps the total derived from item amounts", () => {
    const update = vi.fn();
    render(
      <CmpI18nProvider initialLocale="en-US">
        <FeeNoteDocument note={note} update={update} />
      </CmpI18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /add service item/i }));

    expect(update).toHaveBeenCalledWith(
      "lineItems",
      expect.arrayContaining([
        expect.objectContaining({ description: "Final service fee" }),
        expect.objectContaining({ description: "" }),
      ])
    );
    expect(screen.getByText(/139,900\.00/)).toBeInTheDocument();
  });

  it("keeps the recipient fields local to the visible document language", () => {
    const update = vi.fn();
    render(
      <CmpI18nProvider initialLocale="en-US">
        <FeeNoteDocument note={note} update={update} />
      </CmpI18nProvider>
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: /Recipient address/i }),
      {
        target: { value: "1 Harbour Road\nHong Kong" },
      }
    );

    expect(update).toHaveBeenCalledWith(
      "recipientAddress",
      "1 Harbour Road\nHong Kong"
    );
    expect(
      screen.queryByLabelText("Professional services")
    ).not.toBeInTheDocument();
  });

  it("tolerates a legacy fee note without line items", () => {
    const update = vi.fn();
    const legacyNote = {
      ...note,
      lineItems: undefined,
    } as unknown as CmpEngagementFeeNote;

    render(
      <CmpI18nProvider initialLocale="en-US">
        <FeeNoteDocument note={legacyNote} update={update} />
      </CmpI18nProvider>
    );

    expect(screen.getByText(/0\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add service item/i }));
    expect(update).toHaveBeenCalledWith(
      "lineItems",
      expect.arrayContaining([expect.objectContaining({ description: "" })])
    );
  });

  it("keeps the original paper visible but locks fields for a submitted document", () => {
    render(
      <CmpI18nProvider initialLocale="en-US">
        <FeeNoteDocument
          note={note}
          update={vi.fn()}
          readOnly
          lockedFields={["feeNoteNumber", "engagementReference"]}
        />
      </CmpI18nProvider>
    );

    expect(screen.getAllByDisplayValue("28505")[0]).toBeDisabled();
    expect(screen.getByDisplayValue("Final service fee")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /add service item/i })
    ).toBeDisabled();
  });
});
