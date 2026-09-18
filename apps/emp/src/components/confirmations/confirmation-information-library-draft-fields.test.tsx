import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api/client";
import { ConfirmationInformationLibraryDraftFields } from "./confirmation-information-library-draft-fields";

// @vitest-environment jsdom

vi.mock("../../api/client", () => ({
  api: { confirmationInformationLibrary: vi.fn() },
}));

const selectedEntry = {
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
  apply: "Apply bank information",
  clear: "Clear applied bank information",
  attention: "Attn",
  bankLookup: "Bank and mailing information",
  contact: "Contact",
  empty: "No matching bank",
  loadError: "Failed to load bank information",
  loading: "Loading bank information",
  mailingAddress: "Confirmation mailing address",
  searchPlaceholder: "Search bank code or name",
};

describe(ConfirmationInformationLibraryDraftFields, () => {
  beforeEach(() => {
    vi.mocked(api.confirmationInformationLibrary).mockResolvedValue([
      selectedEntry,
    ]);
  });

  afterEach(cleanup);

  function renderDraftFields(
    overrides: Partial<
      ComponentProps<typeof ConfirmationInformationLibraryDraftFields>
    > = {}
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const props: ComponentProps<
      typeof ConfirmationInformationLibraryDraftFields
    > = {
      copy,
      locale: "zh-CN",
      onChange: vi.fn(),
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      values: {
        bankName: "",
        counterpartyAddress: "",
        counterpartyAttention: "",
        counterpartyContact: "",
      },
      ...overrides,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ConfirmationInformationLibraryDraftFields {...props} />
      </QueryClientProvider>
    );
    return props;
  }

  function openBankLookup() {
    return screen.findByRole("combobox", { name: copy.bankLookup });
  }

  it("mounts bank lookup in a full-width top sheet", async () => {
    renderDraftFields();

    const sheet = await screen.findByRole("dialog", {
      name: copy.bankLookup,
    });
    expect(sheet).toHaveStyle({
      height: "min(42rem, calc(100vh - 2rem))",
    });
    expect(
      screen.getByRole("combobox", { name: copy.bankLookup })
    ).toBeVisible();
  });

  it("keeps parent draft props unchanged while typing a bank query", async () => {
    const user = userEvent.setup();
    const props = renderDraftFields();
    const bankInput = await openBankLookup();
    await user.clear(bankInput);
    await user.type(bankInput, "香港");

    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(copy.mailingAddress)).toHaveValue("");
    expect(screen.getByLabelText(copy.attention)).toHaveValue("");
    expect(screen.getByLabelText(copy.contact)).toHaveValue("");
  });

  it("does not apply a selected snapshot until the user confirms it", async () => {
    const user = userEvent.setup();
    const props = renderDraftFields();
    const bankInput = await openBankLookup();
    await user.type(bankInput, "香港");
    expect(props.onChange).not.toHaveBeenCalled();

    await user.click(
      await screen.findByRole("option", {
        name: /004.*香港上海汇丰银行有限公司/,
      })
    );
    expect(props.onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: copy.apply }));

    expect(props.onChange).toHaveBeenCalledWith({
      confirmationInformationLibraryEntryId: "hk-bank-004",
      bankName: "香港上海汇丰银行有限公司",
      counterpartyAttention: "HSBC Audit Confirmation Team",
      counterpartyAddress:
        "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
      counterpartyContact: "HSBC Audit Confirmation Team",
      recipientAddress:
        "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
      recipientName: "HSBC Audit Confirmation Team",
    });
  });

  it("clears applied library fields while preserving unrelated manual recipients", async () => {
    const onChange = vi.fn();
    const values = {
      confirmationInformationLibraryEntryId: "hk-bank-004",
      bankName: "香港上海汇丰银行有限公司",
      counterpartyAddress:
        "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong",
      counterpartyAttention: "HSBC Audit Confirmation Team",
      counterpartyContact: "HSBC Audit Confirmation Team",
      recipientAddress: "Manual recipient address",
      recipientName: "Manual recipient",
    };

    renderDraftFields({ onChange, values });

    const user = userEvent.setup();
    await openBankLookup();
    await user.click(screen.getByRole("button", { name: copy.clear }));

    expect(onChange).toHaveBeenCalledWith({
      confirmationInformationLibraryEntryId: "",
      bankName: "",
      counterpartyAddress: "",
      counterpartyAttention: "",
      counterpartyContact: "",
    });
  });

  it("clears recipients that still equal the applied library snapshot", async () => {
    const onChange = vi.fn();
    const mappedAddress =
      "1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong";
    const values = {
      confirmationInformationLibraryEntryId: "hk-bank-004",
      bankName: "香港上海汇丰银行有限公司",
      counterpartyAddress: mappedAddress,
      counterpartyAttention: "HSBC Audit Confirmation Team",
      counterpartyContact: "HSBC Audit Confirmation Team",
      recipientAddress: mappedAddress,
      recipientName: "HSBC Audit Confirmation Team",
    };

    renderDraftFields({ onChange, values });

    const user = userEvent.setup();
    await openBankLookup();
    await user.click(screen.getByRole("button", { name: copy.clear }));

    expect(onChange).toHaveBeenCalledWith({
      confirmationInformationLibraryEntryId: "",
      bankName: "",
      counterpartyAddress: "",
      counterpartyAttention: "",
      counterpartyContact: "",
      recipientAddress: "",
      recipientName: "",
    });
  });

  it("keeps the draft preview unchanged while searching and selecting", async () => {
    const user = userEvent.setup();
    const initialValues = {
      bankName: "Existing bank",
      counterpartyAddress: "Existing address",
      counterpartyAttention: "Existing attention",
      counterpartyContact: "Existing contact",
    };
    function ControlledDraftFields() {
      const [values, setValues] = useState(initialValues);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <>
            <ConfirmationInformationLibraryDraftFields
              copy={copy}
              locale="zh-CN"
              onChange={(patch) =>
                setValues((current) => ({ ...current, ...patch }))
              }
              templateCode="SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
              values={values}
            />
            <output data-testid="draft-preview">
              {JSON.stringify(values)}
            </output>
          </>
        </QueryClientProvider>
      );
    }

    render(<ControlledDraftFields />);
    const preview = screen.getByTestId("draft-preview");
    const bankInput = await openBankLookup();
    await user.clear(bankInput);
    await user.type(bankInput, "香港");
    expect(preview).toHaveTextContent(JSON.stringify(initialValues));

    await user.click(
      await screen.findByRole("option", {
        name: /004.*香港上海汇丰银行有限公司/,
      })
    );
    expect(preview).toHaveTextContent(JSON.stringify(initialValues));

    await user.click(screen.getByRole("button", { name: copy.apply }));
    expect(preview).toHaveTextContent(
      String.raw`1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong`
    );
    expect(preview).toHaveTextContent("HSBC Audit Confirmation Team");
    expect(preview).toHaveTextContent(
      "The Hongkong and Shanghai Banking Corporation Limited"
    );
    expect(preview).toHaveTextContent(
      String.raw`"recipientAddress":"1/F, Tower 2, HSBC Centre\n1 Sham Mong Road, Kowloon, Hong Kong"`
    );
    expect(preview).toHaveTextContent(
      '"recipientName":"HSBC Audit Confirmation Team"'
    );
  });

  it("keeps every populated value manually editable", () => {
    const onChange = vi.fn();
    renderDraftFields({
      locale: "en-US",
      onChange,
      templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      values: {
        bankName: "Bank of China (Hong Kong) Limited",
        counterpartyAddress: "Old address",
        counterpartyAttention: "Old attention",
        counterpartyContact: "Old contact",
      },
    });

    fireEvent.change(screen.getByLabelText(copy.mailingAddress), {
      target: { value: "Updated address" },
    });
    fireEvent.change(screen.getByLabelText(copy.attention), {
      target: { value: "Updated attention" },
    });
    fireEvent.change(screen.getByLabelText(copy.contact), {
      target: { value: "Updated contact" },
    });

    expect(onChange).toHaveBeenCalledWith({
      counterpartyAddress: "Updated address",
    });
    expect(onChange).toHaveBeenCalledWith({
      counterpartyAttention: "Updated attention",
    });
    expect(onChange).toHaveBeenCalledWith({
      counterpartyContact: "Updated contact",
    });
  });
});
