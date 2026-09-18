import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import { getDictionary } from "../../i18n/dictionaries";
import { ProjectConfirmationDispatchAction } from "./project-confirmation-dispatch-action";

describe(ProjectConfirmationDispatchAction, () => {
  afterEach(cleanup);

  it("offers an optional sent-confirmation scan without blocking dispatch", async () => {
    const dictionary = await getDictionary("en-US");
    const onDispatch = vi.fn().mockResolvedValue({
      id: "confirmation-1",
      dispatches: [{ id: "dispatch-1" }],
    });
    const onUploadDispatchScan = vi.fn().mockResolvedValue(null as never);

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        defaultRecipientContact="recipient@example.test"
        defaultRecipientName="Orchid Bank"
        locale="en-US"
        mailConnection={{
          connected: true,
          emailAddress: "sender@example.test",
          lastError: null,
          lastTestedAt: "2026-07-14T01:00:00.000Z",
          provider: "WECOM_EXMAIL",
          status: "CONNECTED",
          updatedAt: "2026-07-14T01:00:00.000Z",
          verifiedAt: "2026-07-14T01:00:00.000Z",
        }}
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        onDispatch={onDispatch}
        onUploadDispatchScan={onUploadDispatchScan}
        searchTrackingCarriers={vi.fn().mockResolvedValue([])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent)
    ).toStrictEqual(["Ordinary Letter", "Express Delivery", "Email", "Others"]);
    fireEvent.click(screen.getByText("Email"));

    const scan = new File(["scan"], "sent-confirmation.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Upload sent confirmation scan"), {
      target: { files: [scan] },
    });
    expect(screen.getByText("sent-confirmation.pdf")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Send email" }));

    await waitFor(() =>
      expect(onUploadDispatchScan).toHaveBeenCalledWith(
        expect.objectContaining({ id: "confirmation-1" }),
        scan
      )
    );
    expect(onDispatch).toHaveBeenCalledOnce();
  });

  it("uses a wide editable email composer with a fixed PDF attachment", async () => {
    const dictionary = await getDictionary("en-US");

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        defaultRecipientContact="recipient@example.test"
        defaultRecipientName="Orchid Bank"
        isDispatching={false}
        isWithdrawing={false}
        locale="en-US"
        mailConnection={{
          connected: true,
          emailAddress: "sender@example.test",
          lastError: null,
          lastTestedAt: "2026-07-14T01:00:00.000Z",
          provider: "WECOM_EXMAIL",
          status: "CONNECTED",
          updatedAt: "2026-07-14T01:00:00.000Z",
          verifiedAt: "2026-07-14T01:00:00.000Z",
        }}
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        onDispatch={vi.fn()}
        onWithdraw={vi.fn()}
        searchTrackingCarriers={vi.fn().mockResolvedValue([])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));
    fireEvent.click(screen.getByText("Email"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("sm:max-w-4xl");
    expect(screen.getByText("sender@example.test")).toBeVisible();
    expect(screen.getByText("Connected")).toHaveClass("bg-primary");
    expect(screen.queryByLabelText("Recipient")).not.toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveValue("recipient@example.test");
    expect(screen.getByLabelText("Email subject")).toHaveValue(
      "Confirmation: Orchid confirmation"
    );
    expect(screen.getByText("Orchid confirmation.pdf")).toBeVisible();
    expect(screen.getByText("Fixed attachment")).toBeVisible();

    const body = screen.getByLabelText("Email body");
    fireEvent.change(body, { target: { value: "Updated message" } });
    expect(body).toHaveValue("Updated message");
  });

  it("keeps the confirmation recipient name in email audit data", async () => {
    const dictionary = await getDictionary("en-US");
    const onDispatch = vi.fn();

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        defaultRecipientContact="recipient@example.test"
        defaultRecipientName="Orchid Bank"
        mailConnection={{
          connected: true,
          emailAddress: "sender@example.test",
          lastError: null,
          lastTestedAt: "2026-07-14T01:00:00.000Z",
          provider: "WECOM_EXMAIL",
          status: "CONNECTED",
          updatedAt: "2026-07-14T01:00:00.000Z",
          verifiedAt: "2026-07-14T01:00:00.000Z",
        }}
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        locale="en-US"
        onDispatch={onDispatch}
        onWithdraw={vi.fn()}
        searchTrackingCarriers={vi.fn().mockResolvedValue([])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));
    fireEvent.click(screen.getByText("Email"));
    fireEvent.click(screen.getByRole("button", { name: "Send email" }));

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "EMAIL",
        recipientContact: "recipient@example.test",
        recipientName: "Orchid Bank",
      })
    );
  });

  it("records an externally booked courier dispatch without a tracking number", async () => {
    const dictionary = await getDictionary("en-US");
    const onDispatch = vi.fn();

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        defaultRecipientContact="1 Finance Street"
        defaultRecipientName="Orchid Bank"
        locale="en-US"
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        onDispatch={onDispatch}
        onWithdraw={vi.fn()}
        searchTrackingCarriers={vi.fn().mockResolvedValue([])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));
    fireEvent.click(screen.getByText("Express Delivery"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("sm:max-w-lg");
    expect(screen.getByRole("combobox", { name: "Carrier" })).toHaveTextContent(
      "Auto detect"
    );
    expect(screen.getByLabelText("Tracking number")).toBeVisible();
    expect(
      screen.getByText(dictionary.confirmations.tracking.dispatchScanOptional, {
        selector: "p",
      })
    ).toBeVisible();
    expect(screen.queryByLabelText("Recipient")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Email / address / contact")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Courier / postal service")
    ).not.toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: "Confirm dispatched",
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "COURIER",
        recipientContact: "1 Finance Street",
        recipientName: "Orchid Bank",
        trackingNumber: undefined,
      })
    );
  });

  it("lets users choose a carrier before the first courier dispatch", async () => {
    const dictionary = await getDictionary("zh-CN");
    const onDispatch = vi.fn();
    const searchTrackingCarriers = vi.fn().mockResolvedValue([
      {
        code: 191_222,
        countryIso: "CN",
        name: "WHWDT",
        nameZh: "武汉沃德通",
      },
    ]);

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        defaultRecipientContact="武汉"
        defaultRecipientName="Orchid Bank"
        locale="zh-CN"
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        onDispatch={onDispatch}
        onWithdraw={vi.fn()}
        searchTrackingCarriers={searchTrackingCarriers}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "发送函证" }));
    fireEvent.click(screen.getByText("物流速递"));
    fireEvent.click(screen.getByRole("combobox", { name: "运输商" }));
    fireEvent.change(screen.getByLabelText("搜索运输商名称或代码"), {
      target: { value: "武汉" },
    });

    await waitFor(() =>
      expect(searchTrackingCarriers).toHaveBeenLastCalledWith("武汉")
    );
    fireEvent.click(screen.getByRole("option", { name: /武汉沃德通/ }));
    fireEvent.change(screen.getByLabelText("快递单号"), {
      target: { value: "R26062747635767" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认已寄出" }));

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        courierName: "武汉沃德通",
        method: "COURIER",
        trackingCarrierCode: 191_222,
        trackingNumber: "R26062747635767",
      })
    );
  });

  it("collects required query details declared by the selected carrier", async () => {
    const dictionary = await getDictionary("zh-CN");
    const onDispatch = vi.fn();
    const searchTrackingCarriers = vi.fn().mockResolvedValue([
      {
        code: 190_766,
        countryIso: "CN",
        name: "SF Express(CN)",
        nameZh: "顺丰速运(CN)",
        requirements: [
          {
            key: "phone_number_last_4",
            description: "phone_number_last_4",
            options: null,
            required: true,
            sample: "8888",
          },
        ],
      },
    ]);

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        locale="zh-CN"
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        onDispatch={onDispatch}
        onWithdraw={vi.fn()}
        searchTrackingCarriers={searchTrackingCarriers}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "发送函证" }));
    fireEvent.click(screen.getByText("物流速递"));
    fireEvent.click(screen.getByRole("combobox", { name: "运输商" }));
    fireEvent.change(screen.getByLabelText("搜索运输商名称或代码"), {
      target: { value: "顺丰" },
    });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /顺丰速运/ })).toBeVisible()
    );
    fireEvent.click(screen.getByRole("option", { name: /顺丰速运/ }));
    expect(screen.getByLabelText(/手机号码后四位/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("快递单号"), {
      target: { value: "SF123456" },
    });
    expect(screen.getByRole("button", { name: "确认已寄出" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/手机号码后四位/), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认已寄出" }));

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingCarrierCode: 190_766,
        trackingQueryParameters: { phone_number_last_4: "1234" },
      })
    );
  });

  it("keeps the dispatch dialog open when registration fails", async () => {
    const dictionary = await getDictionary("en-US");
    const onDispatch = vi
      .fn()
      .mockRejectedValue(new Error("Carrier cannot be detected"));

    render(
      <ProjectConfirmationDispatchAction
        attachmentFileName="Orchid confirmation.pdf"
        confirmationName="Orchid confirmation"
        copy={{
          ...dictionary.confirmations.tracking,
          cancel: dictionary.common.cancel,
        }}
        locale="en-US"
        methodLabels={dictionary.confirmations.dispatchMethodLabels}
        onDispatch={onDispatch}
        onWithdraw={vi.fn()}
        searchTrackingCarriers={vi.fn().mockResolvedValue([])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));
    fireEvent.click(screen.getByText("Express Delivery"));
    fireEvent.change(screen.getByLabelText("Tracking number"), {
      target: { value: "R26062747635767" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm dispatched" }));

    await waitFor(() =>
      expect(onDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.any(String),
          method: "COURIER",
          trackingNumber: "R26062747635767",
        })
      )
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText("Tracking number")).toHaveValue(
      "R26062747635767"
    );
  });
});
