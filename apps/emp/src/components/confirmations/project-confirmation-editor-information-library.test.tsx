// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/extend/pdf-viewer", () => ({
  PDFViewer: ({
    renderPageOverlay,
  }: {
    renderPageOverlay?: (input: {
      pageNumber: number;
      pageWidth: number;
      pageHeight: number;
      rotation: number;
      scale: number;
    }) => ReactNode;
  }) => (
    <div data-testid="pdf-preview">
      {renderPageOverlay?.({
        pageNumber: 1,
        pageWidth: 595,
        pageHeight: 842,
        rotation: 0,
        scale: 1,
      })}
    </div>
  ),
}));
vi.mock("@/components/extend/docx-viewer", () => ({
  DocxViewerPreview: () => <div data-testid="docx-preview" />,
}));

const bankEntry = vi.hoisted(() => ({
  id: "hk-bank-012",
  bankCode: "012",
  bankNameEn: "Bank of China (Hong Kong) Limited",
  bankNameZh: "中国银行（香港）有限公司",
  bankType: "BANK",
  businessAddress: "3/F, Bank of China Centre",
  mailingAddress: null,
  mailingAddressSameAsBusiness: true,
  contactName: "Bank of China (Hong Kong) Limited",
  attention: "Bank confirmation",
  effectiveMailingAddress: "3/F, Bank of China Centre",
  historicalMailingAddress: "Old confirmation office\nFormer mailing office",
  background: "Major note-issuing bank",
  notes: "Use the dedicated confirmation desk",
  cautions: "Check the latest mailing instructions",
  sourceLabel: "Seed",
  sourceRow: 12,
  isReadyForDispatch: true,
  isActive: true,
}));
const mockConfirmationInformationLibrary = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", () => ({
  api: {
    confirmationInformationLibrary: mockConfirmationInformationLibrary,
  },
}));

import { defaultProjectConfirmationsCopy } from "../project-confirmations-panel";
import { ProjectConfirmationEditor } from "./project-confirmation-editor";

const derivedValues = {
  balanceSheetDate: "2026-12-31",
  clientCode: "CL-001",
  clientName: "Orchid Holdings",
  confirmationCode: "YH-001",
  contactEmail: "bonnie@example.com",
  contactName: "Bonnie Su",
  fiscalYear: "2026",
  picName: "Engagement PIC",
  projectCode: "AUD-2026-0001",
  projectName: "Orchid Holdings 2026 audit",
};

describe("ProjectConfirmationEditor information-library integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
    mockConfirmationInformationLibrary.mockResolvedValue([bankEntry]);
  });

  afterEach(cleanup);
  it("paginates bank results and resets the page for search and page size changes", async () => {
    const user = userEvent.setup();
    const banks = Array.from({ length: 65 }, (_, index) => ({ ...bankEntry,
      id: `bank-${index}`, bankCode: String(index + 1).padStart(3, "0"), bankNameZh: `银行 ${index + 1}`,
    }));
    mockConfirmationInformationLibrary.mockImplementation(async ({ query }: { query: string }) => query ? banks.slice(0, 2) : banks);
    render(<QueryClientProvider client={createQueryClient()}>
      <ProjectConfirmationEditor copy={defaultProjectConfirmationsCopy} derivedValues={derivedValues}
        confirmationType="BANK" templateCode={null} draftPayload={{}} locale="zh-CN" onSave={vi.fn()}
        onSubmit={vi.fn()} onTemplateSelect={vi.fn()} />
    </QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    expect(await screen.findByText("1-30 / 65")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(31);
    fireEvent.click(screen.getByRole("button", { name: "第 2 页" }));
    expect(screen.getByText("31-60 / 65")).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "每页条数" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["30 / 页", "40 / 页", "50 / 页"]);
    await user.click(screen.getByRole("option", { name: "50 / 页" }));
    expect(await screen.findByText("1-50 / 65")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "第 2 页" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索银行代码、中英文名称" }), { target: { value: "001" } });
    expect(await screen.findByText("1-2 / 2")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索银行代码、中英文名称" }), { target: { value: "" } });
    expect(await screen.findByText("1-50 / 65")).toBeVisible();
  });
  it("queries and associates a bank before choosing a template", async () => {
    const onTemplateSelect = vi.fn();
    render(<QueryClientProvider client={createQueryClient()}>
      <ProjectConfirmationEditor copy={defaultProjectConfirmationsCopy} derivedValues={derivedValues}
        confirmationType="BANK" templateCode={null} draftPayload={{}} locale="zh-CN" onSave={vi.fn()} availableTemplateOptions={[{ code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH", label: "Test bank template" }]}
        onSubmit={vi.fn()} onTemplateSelect={onTemplateSelect} />
    </QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    expect(await screen.findByText("012")).toBeVisible();
    expect(mockConfirmationInformationLibrary).toHaveBeenCalledWith({ includeInactive: false, query: "" });
    fireEvent.change(screen.getByRole("textbox", { name: "搜索银行代码、中英文名称" }), { target: { value: "012" } });
    await screen.findByText("012");
    expect(mockConfirmationInformationLibrary).toHaveBeenCalledWith({ includeInactive: false, query: "012" });
    fireEvent.change(screen.getByRole("textbox", { name: "搜索银行代码、中英文名称" }), { target: { value: "" } });
    expect(await screen.findByText("012")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.queryByTestId("confirmation-bank-query-panel")).not.toBeInTheDocument();
    expect(screen.getByText(/中国银行（香港）有限公司/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirmation template" }));
    fireEvent.click(await screen.findByRole("option", { name: /Test bank template/ }));
    expect(onTemplateSelect).toHaveBeenCalledWith("BANK_CONFIRMATION_HK_STANDARD_ENGLISH", bankEntry.id);
  });

  it.each([false, true])("blocks a restricted bank from the list or detail apply action (%s)", async (openDetail) => {
    mockConfirmationInformationLibrary.mockResolvedValue([{ ...bankEntry, requiresBankTemplate: true }]);
    const onSave = vi.fn();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ProjectConfirmationEditor copy={defaultProjectConfirmationsCopy} derivedValues={derivedValues}
          draftPayload={{ bankName: "Manual bank" }} locale="zh-CN" onSave={onSave}
          onSubmit={vi.fn()} onTemplateSelect={vi.fn()} templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH" />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索银行代码、中英文名称" }), { target: { value: "012" } });
    const code = await screen.findByText("012");
    if (openDetail) fireEvent.click(code);
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("该银行要求使用银行指定格式");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirmation-bank-query-panel")).toBeInTheDocument();
  });

  function createQueryClient() {
    return new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  }

  it("applies only the bank data source without overwriting draft fields", async () => {
    const onSave = vi.fn();
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{
            bankName: "Manually entered bank",
            counterpartyAddress: "Manually entered counterparty address",
            counterpartyAttention: "Manually entered attention",
            counterpartyContact: "Manually entered contact",
            recipientAddress: "Manually entered recipient address",
            recipientName: "Manually entered recipient",
          }}
          locale="zh-CN"
          onSave={onSave}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "搜索银行代码、中英文名称",
      }),
      { target: { value: "012" } }
    );
    fireEvent.click(await screen.findByText("012"));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmationInformationLibraryEntryId: "hk-bank-012",
          bankName: "Manually entered bank",
          counterpartyAddress: "Manually entered counterparty address",
          counterpartyAttention: "Manually entered attention",
          counterpartyContact: "Manually entered contact",
          recipientAddress: "Manually entered recipient address",
          recipientName: "Manually entered recipient",
        })
      );
    });
  });

  it("keeps standard preview fields empty after applying a bank source", async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={
            {
              templateDesignSchema: {
                version: 1,
                fields: [
                  {
                    id: "linked-bank-name",
                    kind: "TEXT",
                    name: "Linked bank",
                    informationLibraryBinding: "bankName",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.2,
                    width: 0.3,
                    height: 0.04,
                  },
                ],
              },
              templateFieldValues: {},
            } as never
          }
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="STANDARD_FINANCIAL_INSTITUTION"
          uploadedDocumentUrl="blob:standard-preview"
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "搜索银行代码、中英文名称",
      }),
      { target: { value: "012" } }
    );
    fireEvent.click(await screen.findByText("012"));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));

    const linkedBank = screen.getByLabelText("Linked bank");
    expect(linkedBank).toHaveValue("");
    fireEvent.click(linkedBank);
    expect(
      await screen.findByRole("option", { name: bankEntry.bankNameZh })
    ).toBeVisible();
  });

  it("does not populate legacy unbound preview fields after applying a bank source", async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={
            {
              templateDesignSchema: {
                version: 1,
                fields: [
                  {
                    id: "field-1",
                    kind: "TEXT",
                    name: "Recipient",
                    placeholder: "To the Manager",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.1,
                    width: 0.3,
                    height: 0.04,
                  },
                  {
                    id: "field-2",
                    kind: "TEXT",
                    name: "Bank office",
                    placeholder: "Bank Office",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.16,
                    width: 0.3,
                    height: 0.04,
                  },
                ],
              },
              templateFieldValues: {},
            } as never
          }
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="STANDARD_FINANCIAL_INSTITUTION"
          uploadedDocumentUrl="blob:standard-preview"
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "搜索银行代码、中英文名称",
      }),
      { target: { value: "012" } }
    );
    fireEvent.click(await screen.findByText("012"));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));

    expect(screen.getByLabelText("Recipient")).toHaveValue("");
    expect(screen.getByLabelText("Bank office")).toHaveValue("");
  });

  it("opens the information library as a workspace overlay with search and close controls", async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        />
      </QueryClientProvider>
    );

    const trigger = screen.getByRole("button", { name: "Bank lookup" });
    fireEvent.click(trigger);

    expect(screen.getByTestId("confirmation-bank-query-panel")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "银行查询" })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("confirmation-bank-query-panel")).toHaveAttribute(
      "data-entry-motion",
      "pull-down"
    );
    expect(screen.getByTestId("confirmation-bank-query-panel")).toHaveAttribute(
      "data-scroll-mode",
      "contained"
    );
    expect(
      await screen.findByRole("table", { name: "函证信息库" })
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "搜索银行代码、中英文名称",
      })
    ).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "关闭银行查询" }));

    expect(
      screen.queryByTestId("confirmation-bank-query-panel")
    ).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows only code, localized name, and a direct apply action in search results", async () => {
    const onSave = vi.fn();
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          locale="zh-CN"
          onSave={onSave}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "搜索银行代码、中英文名称",
      }),
      { target: { value: "012" } }
    );

    await screen.findByText("012");
    const table = screen.getByRole("table", { name: "函证信息库" });
    expect(table.parentElement).toHaveClass("overflow-x-hidden");
    expect(table).toHaveTextContent("012");
    expect(table).toHaveTextContent(bankEntry.bankNameZh);
    expect(table).not.toHaveTextContent(bankEntry.bankNameEn);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmationInformationLibraryEntryId: bankEntry.id,
        })
      );
    });
  });

  it.each([bankEntry.notes, null, "", "   "])("opens the full bank details with notes %s", async (notes) => {
    mockConfirmationInformationLibrary.mockResolvedValue([{ ...bankEntry, notes }]);
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Bank lookup" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "搜索银行代码、中英文名称",
      }),
      { target: { value: "012" } }
    );
    fireEvent.click(
      await screen.findByRole("button", { name: bankEntry.bankNameZh })
    );

    const applyButton = screen.getByRole("button", { name: "应用" });
    const backButton = screen.getByRole("button", { name: "返回搜索结果" });
    const closeButton = screen.getByRole("button", { name: "关闭银行查询" });
    expect(applyButton.parentElement).toContainElement(backButton);
    expect(applyButton.parentElement).toContainElement(closeButton);
    expect(closeButton).not.toHaveClass("absolute", "bg-card/90", "shadow-sm");
    expect(screen.getAllByRole("button", { name: "应用" })).toHaveLength(1);
    expect(screen.getAllByText(bankEntry.bankNameEn)[0]).toBeVisible();
    expect(screen.getByText(bankEntry.background)).toBeVisible();
    if (notes?.trim()) {
      expect(screen.getByText(notes)).toHaveClass("text-destructive");
      expect(screen.getByText(notes).parentElement).toHaveClass("border-destructive/30", "bg-destructive/5");
      expect(screen.getByText(notes).compareDocumentPosition(screen.getByText(bankEntry.background)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } else {
      expect(screen.queryByTestId("bank-note-warning")).not.toBeInTheDocument();
    }
    expect(screen.queryByText("备注")).not.toBeInTheDocument();
    expect(screen.getByText(bankEntry.cautions)).toBeVisible();
    expect(screen.getByText(/Old confirmation office/)).toBeVisible();
  });

  it("keeps the bank lookup available when switching to a bank custom template", async () => {
    const queryClient = createQueryClient();
    const onTemplateSelect = vi.fn();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={onTemplateSelect}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
          confirmationType="BANK"
          availableTemplateOptions={[
            {
              code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
              label: "标准银行函证模板",
            },
            { code: "CTPL-BANK-2026-000001", label: "test" },
          ]}
        />
      </QueryClientProvider>
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={onTemplateSelect}
          templateCode="CTPL-BANK-2026-000001"
          confirmationType="BANK"
          availableTemplateOptions={[
            {
              code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
              label: "标准银行函证模板",
            },
            { code: "CTPL-BANK-2026-000001", label: "test" },
          ]}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: "Bank lookup" })).toBeVisible();
  });

  it("shows the applied bank and offers current plus historical linked addresses", async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          baseInformationOptions={{
            banks: [
              {
                name: "基础信息银行名称",
                account: "BASE-ACCOUNT",
                address: "Base information address",
              },
            ],
          }}
          draftPayload={
            {
              confirmationInformationLibraryEntryId: bankEntry.id,
              bankName: bankEntry.bankNameZh,
              recipientName: bankEntry.contactName,
              recipientAddress: bankEntry.effectiveMailingAddress,
              templateDesignSchema: {
                version: 1,
                fields: [
                  {
                    id: "library-bank-name",
                    kind: "TEXT",
                    name: "Bank name",
                    binding: "bankName",
                    informationLibraryBinding: "bankName",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.05,
                    width: 0.4,
                    height: 0.04,
                  },
                  {
                    id: "library-address",
                    kind: "TEXT",
                    name: "Mailing address",
                    informationLibraryBinding: "recipientAddress",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.1,
                    width: 0.4,
                    height: 0.04,
                  },
                ],
              },
              templateFieldValues: {},
            } as never
          }
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
          uploadedDocumentUrl="blob:bank-preview"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(`Applied: ${bankEntry.bankNameZh}`)).toBeVisible();
    fireEvent.click(screen.getByLabelText("Bank name"));
    await waitFor(() => {
      expect(
        screen.getAllByRole("option").map((option) => option.textContent)
      ).toEqual(["基础信息银行名称", bankEntry.bankNameZh]);
    });
    fireEvent.keyDown(screen.getByLabelText("Bank name"), { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Bank name"), {
      target: { value: "手工修改后的银行名称" },
    });
    expect(screen.getByText(`Applied: ${bankEntry.bankNameZh}`)).toBeVisible();
    expect(
      screen.queryByText("Applied: 手工修改后的银行名称")
    ).not.toBeInTheDocument();
    const address = screen.getByLabelText("Mailing address");
    fireEvent.click(address);
    await waitFor(() => {
      expect(
        screen.getAllByRole("option").map((option) => option.textContent)
      ).toEqual([
        bankEntry.effectiveMailingAddress,
        "Old confirmation office",
        "Former mailing office",
      ]);
    });

    fireEvent.change(address, { target: { value: "Manual address override" } });
    await waitFor(() => {
      expect(
        screen.getAllByRole("option").map((option) => option.textContent)
      ).toEqual([
        bankEntry.effectiveMailingAddress,
        "Old confirmation office",
        "Former mailing office",
      ]);
    });
  });

  it("removes the applied bank source without clearing existing field values", async () => {
    const onSave = vi.fn();
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={
            {
              confirmationInformationLibraryEntryId: bankEntry.id,
              bankName: bankEntry.bankNameZh,
              recipientName: bankEntry.contactName,
              recipientAddress: bankEntry.effectiveMailingAddress,
            } as never
          }
          locale="zh-CN"
          onSave={onSave}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        />
      </QueryClientProvider>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Clear applied bank information" })
    );

    expect(
      screen.queryByText(`Applied: ${bankEntry.bankNameZh}`)
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmationInformationLibraryEntryId: "",
          bankName: bankEntry.bankNameZh,
          recipientName: bankEntry.contactName,
          recipientAddress: bankEntry.effectiveMailingAddress,
        })
      );
    });
  });

  it("restores linked choices by the applied entry id when the editable bank name no longer matches", async () => {
    mockConfirmationInformationLibrary.mockImplementation(async (input) =>
      (input as unknown as { entryId?: string }).entryId === bankEntry.id
        ? [bankEntry]
        : []
    );
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={
            {
              confirmationInformationLibraryEntryId: bankEntry.id,
              bankName: "曾被手工修改的名称",
              templateDesignSchema: {
                version: 1,
                fields: [
                  {
                    id: "library-bank-name",
                    kind: "TEXT",
                    name: "Bank name",
                    informationLibraryBinding: "bankName",
                    options: [],
                    page: 1,
                    x: 0.1,
                    y: 0.05,
                    width: 0.4,
                    height: 0.04,
                  },
                ],
              },
              templateFieldValues: {},
            } as never
          }
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
          uploadedDocumentUrl="blob:bank-preview"
        />
      </QueryClientProvider>
    );

    const bankName = screen.getByLabelText("Bank name");
    fireEvent.change(bankName, { target: { value: "" } });
    fireEvent.click(bankName);

    expect(
      await screen.findByRole("option", { name: bankEntry.bankNameZh })
    ).toBeVisible();
    expect(
      await screen.findByText(`Applied: ${bankEntry.bankNameZh}`)
    ).toBeVisible();
    expect(mockConfirmationInformationLibrary).toHaveBeenCalledWith({
      entryId: bankEntry.id,
      includeInactive: true,
    });
  });

  it("does not render the bank library for securities templates", () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectConfirmationEditor
          copy={defaultProjectConfirmationsCopy}
          derivedValues={derivedValues}
          draftPayload={{}}
          locale="zh-CN"
          onSave={vi.fn()}
          onSubmit={vi.fn()}
          onTemplateSelect={vi.fn()}
          templateCode="SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
        />
      </QueryClientProvider>
    );

    expect(
      screen.queryByRole("dialog", { name: "银行查询" })
    ).not.toBeInTheDocument();
  });
});
