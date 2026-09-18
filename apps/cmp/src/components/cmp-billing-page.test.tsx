import type {
  CmpBilling,
  CmpBillingCollectionOverview,
  CmpEngagementFeeNote,
} from "@project-wing/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { CmpToastProvider } from "@/components/cmp-toast";
import { CmpI18nProvider } from "@/i18n/client";
import { openAuthorizedPreviewWindow } from "@/lib/open-preview-window";

import {
  BillingArtifactList,
  CmpBillingPage,
  CollectionOverview,
  billingConversionPreview,
  billingCopy,
  billingAsFeeNote,
  updateBillingDocumentDraft,
} from "./cmp-billing-page";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams("engagementId=engagement-1"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("@/lib/open-preview-window", () => ({
  openAuthorizedPreviewWindow: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/components/cmp-auth-adapter", () => ({
  useCmpSignOut: () => vi.fn(),
}));

vi.mock("@/components/cmp-app-shell", () => ({
  CmpAppShell: ({
    activeSection,
    children,
    searchValue,
    onSearchChange,
  }: {
    activeSection: string;
    children: React.ReactNode;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
  }) => (
    <div data-testid="cmp-app-shell" data-active-section={activeSection}>
      {onSearchChange ? (
        <input
          aria-label="Global billing search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
      {children}
    </div>
  ),
}));

const billing = {
  id: "bill-1",
  engagementId: "engagement-1",
  engagementCode: "ENG-2026-001",
  billNumber: "2026-0001",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
} as CmpBilling;

const billingRow = {
  ...billing,
  clientName: "Example Client",
  status: "DRAFT",
  issueDate: "2026-08-28",
  currency: "USD",
  totalAmount: "1000.00",
  remainingAmount: "750.00",
  financeReceipts: [],
} as CmpBilling;

const draft = {
  issueDate: "2026-08-28",
  currency: "HKD" as const,
  lineItems: [
    {
      key: "line-1",
      id: "line-1",
      descriptionZh: "中文服务",
      descriptionEn: "English service",
      amount: "100.00",
    },
  ],
  clientSnapshot: {},
  firmSnapshot: { phone: "(852) 53667568" },
  localizedContent: {
    "zh-CN": {
      recipientName: "中文客户",
      recipientAttention: "董事",
      recipientSalutation: "贵公司",
      recipientAddress: "",
      serviceDescription: "",
      lineItemDescriptions: {},
      signatoryName: "签署人",
      bankPayeeName: "",
      bankName: "",
      firmLegalName: "维致（香港）会计师事务所",
      firmAddress: "香港",
    },
    "en-US": {
      recipientName: "English client",
      recipientAttention: "Director",
      recipientSalutation: "Your company",
      recipientAddress: "",
      serviceDescription: "",
      lineItemDescriptions: {},
      signatoryName: "Signatory",
      bankPayeeName: "",
      bankName: "",
      firmLegalName: "Wing Zenith",
      firmAddress: "Hong Kong",
    },
  },
};

describe("Billing Fee Note adapter", () => {
  it("presents independent Chinese and English document content from one billing", () => {
    const chinese = billingAsFeeNote(billing, draft, "zh-CN");
    const english = billingAsFeeNote(billing, draft, "en-US");

    expect(chinese.feeNoteNumber).toBe("2026-0001");
    expect(chinese.engagementReference).toBe("ENG-2026-001");
    expect(chinese.lineItems[0]?.description).toBe("中文服务");
    expect(english.lineItems[0]?.description).toBe("English service");
    expect(english.firmLegalName).toBe("Wing Zenith");
    expect(chinese.collectionStatus).toBe("UNISSUED");
    expect(chinese.plannedAmount).toBe("100.00");
  });

  it("keeps stable line keys while changing only the active language", () => {
    const visible: CmpEngagementFeeNote["lineItems"] = [
      { id: "line-1", description: "Edited English", amount: "100.00" },
      {
        id: "draft-line-2",
        description: "Additional English",
        amount: "25.50",
      },
    ];
    const updated = updateBillingDocumentDraft(
      draft,
      "en-US",
      "lineItems",
      visible
    );

    expect(updated.lineItems.map((line) => line.key)).toStrictEqual([
      "line-1",
      "draft-line-2",
    ]);
    expect(updated.lineItems[0]?.descriptionZh).toBe("中文服务");
    expect(updated.lineItems[0]?.descriptionEn).toBe("Edited English");
    expect(updated.lineItems[1]?.descriptionZh).toBe("");
    expect(updated.lineItems[1]?.descriptionEn).toBe("Additional English");
  });

  it("previews a cross-currency receipt using the shared HKD rate batch", () => {
    expect(
      billingConversionPreview(
        "CNY",
        "USD",
        [
          {
            currency: "HKD",
            hkdPerUnit: "1.00000000",
          },
          {
            currency: "CNY",
            hkdPerUnit: "1.12000000",
          },
          {
            currency: "USD",
            hkdPerUnit: "7.80000000",
          },
        ],
        billingCopy.en
      )
    ).toBe("1 CNY = 0.14358974 USD · calculated from the current rate batch");
  });
});

describe(CmpBillingPage, () => {
  it("renders the compact data grid and creates with the engagement currency", async () => {
    vi.spyOn(api, "me").mockResolvedValue({
      id: "user-1",
      name: "Finance Partner",
      globalRole: "PARTNER",
    } as Awaited<ReturnType<typeof api.me>>);
    vi.spyOn(api, "cmpBillings").mockResolvedValue({
      billings: [billingRow],
      revenue: [],
      collectionOverview: {
        scope: "ENGAGEMENT",
        currency: "USD",
        agreedFee: "1000.00",
        actualReceived: "250.00",
        outstanding: "750.00",
        receivedRate: "25.00",
        overReceived: "0.00",
        engagement: {
          id: "engagement-1",
          engagementCode: "ENG-2026-001",
          clientCode: "CL-001",
          clientName: "Example Client",
          serviceType: "ANNUAL_AUDIT",
          status: "ACTIVE",
        },
      },
    });
    vi.spyOn(api, "cmpEngagements").mockResolvedValue({
      engagements: [
        {
          id: "engagement-1",
          engagementCode: "ENG-2026-001",
          feeCurrency: "USD",
          status: "ACTIVE",
          client: {
            clientCode: "CL-001",
            nameZh: "示例客户",
            nameEn: "Example Client",
          },
        },
      ],
    } as Awaited<ReturnType<typeof api.cmpEngagements>>);
    const create = vi
      .spyOn(api, "createCmpBilling")
      .mockResolvedValue(billingRow);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CmpI18nProvider initialLocale="en-US">
          <CmpToastProvider>
            <CmpBillingPage financeCenter />
          </CmpToastProvider>
        </CmpI18nProvider>
      </QueryClientProvider>
    );

    await expect(
      screen.findByTestId("cmp-billing-data-grid")
    ).resolves.toBeVisible();
    expect(screen.getByTestId("cmp-app-shell")).toHaveAttribute(
      "data-active-section",
      "billing"
    );
    expect(
      screen.getByRole("textbox", { name: "Global billing search" })
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(
      screen.getByTestId("cmp-billing-engagement-scope")
    ).toHaveTextContent("Select engagement");
    expect(
      screen
        .getByTestId("cmp-billing-engagement-scope")
        .querySelector(".max-w-3xl")
    ).not.toBeNull();
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
    expect(screen.getByText("USD 750.00")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "New billing" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          engagementId: "engagement-1",
          currency: "USD",
        })
      )
    );
  });
});

describe(CollectionOverview, () => {
  it("shows a single mobile heading and localized engagement status without dropping scope", async () => {
    const viewport = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        matches: query.includes("767"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    const view = render(
      <CollectionOverview
        overview={{
          scope: "ENGAGEMENT",
          currency: "HKD",
          agreedFee: "240000.00",
          actualReceived: "0.00",
          outstanding: "240000.00",
          receivedRate: "0.00",
          overReceived: "0.00",
          engagement: {
            id: "engagement-1",
            engagementCode: "ORC-2026-AUD",
            clientCode: "C-ORC-2026",
            clientName: "Orchid Technology Limited",
            serviceType: "AUDIT",
            status: "ACTIVE",
          },
        }}
        copy={billingCopy.zh}
        locale="zh-CN"
      />
    );
    try {
      fireEvent.click(
        screen.getByRole("button", { name: billingCopy.zh.collectionOverview })
      );
      const sheet = await screen.findByRole("dialog", {
        name: billingCopy.zh.collectionOverview,
      });
      expect(
        within(sheet).getAllByRole("heading", {
          name: billingCopy.zh.collectionOverview,
        })
      ).toHaveLength(1);
      expect(within(sheet).getByText("有效")).toBeVisible();
      expect(within(sheet).queryByText("Active")).not.toBeInTheDocument();
      expect(within(sheet).getByText("ORC-2026-AUD")).toBeVisible();
      expect(
        within(sheet).getByText("Orchid Technology Limited")
      ).toBeVisible();
      expect(within(sheet).getAllByText("HKD 240,000.00")).toHaveLength(2);
    } finally {
      view.unmount();
      viewport.mockRestore();
    }
  });

  it("keeps mobile collection details out of the list while preserving status filters", () => {
    const viewport = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        matches: query.includes("767"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    const onSelectStatusGroup = vi.fn();
    const view = render(
      <CollectionOverview
        overview={{
          scope: "ALL",
          currency: "HKD",
          agreedFee: "100000.00",
          actualReceived: "75000.00",
          outstanding: "25000.00",
          receivedRate: "75.00",
          overReceived: "0.00",
          engagement: null,
        }}
        copy={billingCopy.en}
        locale="en-US"
        rows={[{ ...billingRow, status: "CLIENT_PAID" }]}
        onSelectStatusGroup={onSelectStatusGroup}
      />
    );
    try {
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: billingCopy.en.collectionOverview })
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("img")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Client paid 1" }));
      expect(onSelectStatusGroup).toHaveBeenCalledWith("CLIENT_PAID");
    } finally {
      view.unmount();
      viewport.mockRestore();
    }
  });

  it("shows one received-versus-outstanding donut with the selected engagement ratio", () => {
    const overview: CmpBillingCollectionOverview = {
      scope: "ENGAGEMENT",
      currency: "HKD",
      agreedFee: "100000.00",
      actualReceived: "75000.00",
      outstanding: "25000.00",
      receivedRate: "75.00",
      overReceived: "0.00",
      engagement: {
        id: "engagement-1",
        engagementCode: "ENG-2026-001",
        clientCode: "CL-001",
        clientName: "Example Client",
        serviceType: "AUDIT",
        status: "ACTIVE",
      },
    };

    render(
      <CollectionOverview
        overview={overview}
        copy={billingCopy.en}
        locale="en-US"
      />
    );

    expect(screen.getByText("75.00%")).toBeInTheDocument();
    expect(screen.getByText("Agreed fee")).toBeInTheDocument();
    expect(screen.getAllByText("Actual received")).toHaveLength(2);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Received .*75,000\.00.*agreed fee .*100,000\.00.*75\.00%\./
    );
  });

  it("keeps the received percentage visible when the ratio is below one percent", () => {
    const overview: CmpBillingCollectionOverview = {
      scope: "ENGAGEMENT",
      currency: "HKD",
      agreedFee: "100000.00",
      actualReceived: "20.00",
      outstanding: "99980.00",
      receivedRate: "0.02",
      overReceived: "0.00",
      engagement: null,
    };

    render(
      <CollectionOverview
        overview={overview}
        copy={billingCopy.en}
        locale="en-US"
      />
    );

    expect(screen.getByRole("img")).toHaveTextContent("0.02%Received");
    expect(screen.getByRole("img")).toHaveAccessibleName(/0\.02%/);
  });

  it("shows compact queue counts and exposes them as selectable filters", () => {
    const onSelectStatusGroup = vi.fn();
    const overview: CmpBillingCollectionOverview = {
      scope: "ALL",
      currency: "HKD",
      agreedFee: "100000.00",
      actualReceived: "75000.00",
      outstanding: "25000.00",
      receivedRate: "75.00",
      overReceived: "0.00",
      engagement: null,
    };
    const rows = [
      { status: "DRAFT" },
      { status: "CLIENT_PAID" },
      { status: "CLIENT_PAID" },
    ] as CmpBilling[];

    render(
      <CollectionOverview
        overview={overview}
        copy={billingCopy.en}
        locale="en-US"
        rows={rows}
        onSelectStatusGroup={onSelectStatusGroup}
      />
    );

    expect(screen.getByRole("button", { name: "Draft 1" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Client paid 2" }));
    expect(onSelectStatusGroup).toHaveBeenCalledWith("CLIENT_PAID");
  });
});

describe(BillingArtifactList, () => {
  it("opens a file row in the detached viewer and keeps download separate", async () => {
    const artifact = {
      id: "artifact-invoice-1",
      type: "INVOICE" as const,
      locale: "zh-CN" as const,
      version: 2,
      fileName: "2026-0001-invoice-zh-CN-v2.pdf",
      originalName: "2026-0001-invoice-zh-CN-v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      sha256: "a".repeat(64),
      financeReceiptId: null,
      createdAt: "2026-08-28T08:30:00.000Z",
      retentionUntil: "2033-08-28T08:30:00.000Z",
      uploadedBy: { id: "user-1", name: "Amy Chan" },
    };
    const download = vi
      .spyOn(api, "downloadCmpBillingArtifact")
      .mockResolvedValue();

    render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpToastProvider>
          <BillingArtifactList artifacts={[artifact]} copy={billingCopy.en} />
        </CmpToastProvider>
      </CmpI18nProvider>
    );

    expect(
      screen.getByRole("button", {
        name: `Preview ${artifact.fileName}`,
      })
    ).toHaveTextContent("Invoice");
    expect(
      screen.getByRole("button", {
        name: `Preview ${artifact.fileName}`,
      })
    ).toHaveTextContent("Amy Chan");
    expect(
      screen.getByTestId(`cmp-billing-artifact-name-${artifact.id}`)
    ).toHaveClass("break-all");
    expect(
      screen.getByTestId(`cmp-billing-artifact-name-${artifact.id}`)
    ).not.toHaveClass("truncate");
    fireEvent.click(
      screen.getByRole("button", {
        name: `Preview ${artifact.fileName}`,
      })
    );

    await waitFor(() =>
      expect(openAuthorizedPreviewWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
        })
      )
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `Download ${artifact.fileName}`,
      })
    );
    expect(download).toHaveBeenCalledWith(artifact.id);
  });
});
