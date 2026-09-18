import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api/client";
import { ConfirmationInformationLibraryField } from "./confirmation-information-library-field";

vi.mock("../../api/client", () => ({
  api: { confirmationInformationLibrary: vi.fn() },
}));

const bankOfChina = {
  id: "hk-bank-012",
  bankCode: "012",
  bankNameEn: "Bank of China (Hong Kong) Limited",
  bankNameZh: "中国银行（香港）有限公司",
  bankType: "本地注册银行",
  businessAddress: "Bank of China Tower, 1 Garden Road, Central, Hong Kong",
  mailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  mailingAddressSameAsBusiness: false,
  contactName: "Bank of China (Hong Kong) Limited",
  attention: "Bank confirmation",
  notes: null,
  background: null,
  sourceLabel: "香港银行函证信息库.xlsx",
  sourceRow: 9,
  isActive: true,
  effectiveMailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  isReadyForDispatch: true,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
};
const hsbc = {
  id: "hk-bank-004",
  bankCode: "004",
  bankNameEn: "The Hongkong and Shanghai Banking Corporation Limited",
  bankNameZh: "香港上海汇丰银行有限公司",
  bankType: "本地注册银行",
  businessAddress: "1 Queen's Road Central, Central, Hong Kong",
  mailingAddress:
    "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
  mailingAddressSameAsBusiness: false,
  contactName: "HSBC Audit Confirmation Team",
  attention: null,
  notes: null,
  background: null,
  sourceLabel: "香港银行函证信息库.xlsx",
  sourceRow: 3,
  isActive: true,
  effectiveMailingAddress:
    "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
  isReadyForDispatch: true,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
};
const copy = {
  addressMissing: "No mailing address",
  empty: "No matching bank",
  loadError: "Failed to load bank information",
  loading: "Loading bank information",
};

function renderField(
  overrides: Partial<
    React.ComponentProps<typeof ConfirmationInformationLibraryField>
  > = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const props = {
    copy,
    id: "bank-name",
    label: "Bank",
    locale: "zh-CN",
    onEntrySelect: vi.fn(),
    placeholder: "Search bank",
    templateCode: "STANDARD_FINANCIAL_INSTITUTION",
    value: "",
    ...overrides,
  };

  render(
    <QueryClientProvider client={queryClient}>
      <ConfirmationInformationLibraryField {...props} />
    </QueryClientProvider>
  );
  return props;
}

describe(ConfirmationInformationLibraryField, () => {
  it("blocks a bank requiring its own format without changing the draft", async () => {
    vi.mocked(api.confirmationInformationLibrary).mockResolvedValue([
      { ...hsbc, requiresBankTemplate: true },
    ]);
    const user = userEvent.setup();
    const props = renderField();
    await user.type(await screen.findByRole("combobox", { name: "Bank" }), "香港");
    await user.click(await screen.findByRole("option", { name: /004.*香港上海汇丰银行有限公司/ }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("该银行要求使用银行指定格式");
    expect(props.onEntrySelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "知道了" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.confirmationInformationLibrary).mockResolvedValue([
      bankOfChina,
      hsbc,
    ]);
  });

  afterEach(cleanup);

  it("filters by search text without changing the draft before selection", async () => {
    const user = userEvent.setup();
    const props = renderField();
    const input = await screen.findByRole("combobox", { name: "Bank" });
    await user.type(input, "香港");

    await expect(
      screen.findByRole("option", {
        name: /004.*香港上海汇丰银行有限公司/,
      })
    ).resolves.toBeVisible();
    expect(props.onEntrySelect).not.toHaveBeenCalled();
  });

  it("reports the selected HSBC snapshot without applying it itself", async () => {
    const user = userEvent.setup();
    const props = renderField({
      templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    });
    const input = await screen.findByRole("combobox", { name: "Bank" });
    await user.type(input, "香港");
    await user.click(
      await screen.findByRole("option", {
        name: /004.*香港上海汇丰银行有限公司/,
      })
    );

    expect(props.onEntrySelect).toHaveBeenCalledWith(
      hsbc,
      expect.objectContaining({
        confirmationInformationLibraryEntryId: "hk-bank-004",
        bankName: "The Hongkong and Shanghai Banking Corporation Limited",
        counterpartyAddress: hsbc.effectiveMailingAddress,
        counterpartyAttention: "HSBC Audit Confirmation Team",
        counterpartyContact: "HSBC Audit Confirmation Team",
        recipientAddress: hsbc.effectiveMailingAddress,
        recipientName: "HSBC Audit Confirmation Team",
      })
    );
  });

  it("keeps typing as search-only when no database entry is selected", async () => {
    const user = userEvent.setup();
    const props = renderField();

    await user.type(
      await screen.findByRole("combobox", { name: "Bank" }),
      "Manual Bank"
    );

    expect(props.onEntrySelect).not.toHaveBeenCalled();
  });

  it("does not request data while read only", () => {
    renderField({ readOnly: true });

    expect(api.confirmationInformationLibrary).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Bank" })).toHaveAttribute(
      "readonly"
    );
  });
});
