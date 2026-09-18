import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import type { ProjectConfirmationDispatch } from "../../api/client";
import { getDictionary } from "../../i18n/dictionaries";
import type * as ErrorToastModule from "../../lib/error-toast";
import { ConfirmationShipmentTracking } from "./confirmation-shipment-tracking";

const errorToast = vi.hoisted(() => vi.fn());
vi.mock("../../lib/error-toast", async (importOriginal) => ({
  ...(await importOriginal<typeof ErrorToastModule>()),
  showErrorToast: errorToast,
}));

describe(ConfirmationShipmentTracking, () => {
  afterEach(() => {
    cleanup();
    errorToast.mockClear();
  });

  it("only asks for missing phone digits and retries the same shipment", async () => {
    const dictionary = await getDictionary("zh-CN");
    const onCorrectTracking = vi.fn().mockResolvedValue({});
    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={{
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          executionStatus: "SENT",
          trackingNumber: "JD123456",
          trackingError:
            "The 'phone_number_last_4' field is required for this tracking.",
          createdBy: "user-1",
          createdAt: "2026-07-16T06:00:00.000Z",
        }}
        locale="zh-CN"
        onCorrectTracking={onCorrectTracking}
      />
    );
    expect(
      screen.getByText("已登记，补充手机号后四位即可查询物流，可稍后补充")
    ).toBeVisible();
    expect(screen.queryByLabelText("更正原因")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "运输商" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查询物流" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("手机号码后四位"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查询物流" }));
    await waitFor(() =>
      expect(onCorrectTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingNumber: "JD123456",
          trackingQueryParameters: { phone_number_last_4: "1234" },
        })
      )
    );
    expect(errorToast).not.toHaveBeenCalled();
  });

  it("keeps phone digits after a rejected query and does not create a dispatch", async () => {
    const dictionary = await getDictionary("zh-CN");
    const onCorrectTracking = vi
      .fn()
      .mockRejectedValue(new Error("请核对手机号后四位"));
    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={{
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          executionStatus: "SENT",
          trackingNumber: "JD123456",
          trackingError: "The 'phone_number_last_4' field is required",
          createdBy: "user-1",
          createdAt: "2026-07-16T06:00:00.000Z",
        }}
        locale="zh-CN"
        onCorrectTracking={onCorrectTracking}
      />
    );
    fireEvent.change(screen.getByLabelText("手机号码后四位"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查询物流" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("请核对手机号后四位")
    );
    expect(screen.getByLabelText("手机号码后四位")).toHaveValue("1234");
    expect(onCorrectTracking).toHaveBeenCalledOnce();
  });

  it("does not claim tracking information was received when the provider says NotFound", async () => {
    const dictionary = await getDictionary("zh-CN");
    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={{
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          executionStatus: "SENT",
          trackingNumber: "JD123456",
          trackingRegisteredAt: "2026-07-16T06:00:00.000Z",
          trackingStatus: "NotFound",
          createdBy: "user-1",
          createdAt: "2026-07-16T06:00:00.000Z",
        }}
        locale="zh-CN"
      />
    );
    expect(screen.getByText("等待物流更新")).toBeVisible();
    expect(screen.queryByText("物流信息已收到")).not.toBeInTheDocument();
  });

  it("formats shipment update timestamps by day", async () => {
    const dictionary = await getDictionary("en-US");
    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={{
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          trackingNumber: "R26062747635767",
          trackingStatus: "InTransit",
          trackingDescription: "Shipment is moving",
          trackingUpdatedAt: "2026-07-16T06:01:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-07-16T06:00:00.000Z",
        }}
        locale="en-US"
      />
    );

    const updated = screen.getByText((content) =>
      content.startsWith("Updated Jul 16, 2026")
    );
    expect(updated).toBeVisible();
    expect(updated).toHaveTextContent("Updated Jul 16, 2026");
    expect(updated.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("lets users refresh an already registered shipment", async () => {
    const dictionary = await getDictionary("zh-CN");
    const onRefreshTracking = vi.fn();
    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={{
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          trackingNumber: "SF123456",
          trackingRegisteredAt: "2026-07-16T06:01:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-07-16T06:00:00.000Z",
        }}
        locale="zh-CN"
        onRefreshTracking={onRefreshTracking}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "刷新物流" }));
    expect(onRefreshTracking).toHaveBeenCalledOnce();
  });

  it("shows a top warning instead of exposing the registration error", async () => {
    const dictionary = await getDictionary("zh-CN");
    const dispatch: ProjectConfirmationDispatch = {
      id: "dispatch-1",
      confirmationId: "confirmation-1",
      sequence: 1,
      method: "COURIER",
      trackingNumber: "R26062747635767",
      trackingError: "17TRACK responded with code -18010002",
      trackingUpdatedAt: "2026-07-16T06:01:00.000Z",
      createdBy: "user-1",
      createdAt: "2026-07-16T06:00:00.000Z",
    };

    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={dispatch}
        locale="zh-CN"
      />
    );

    expect(
      screen.getByText("物流接入失败，请检查 17TRACK 配置或快递单号")
    ).toBeVisible();
    expect(errorToast).toHaveBeenCalledWith(
      expect.any(Error),
      "物流接入失败，请检查 17TRACK 配置或快递单号"
    );
    expect(screen.queryByText(/接入详情：17TRACK/)).not.toBeInTheDocument();
    expect(screen.queryByText("已登记，等待物流更新")).not.toBeInTheDocument();
  });

  it("allows a sent shipment to be corrected with a selected carrier", async () => {
    const dictionary = await getDictionary("zh-CN");
    const onCorrectTracking = vi.fn();
    const searchTrackingCarriers = vi.fn().mockResolvedValue([
      {
        code: 191_222,
        countryIso: "CN",
        name: "WHWDT",
        nameZh: "武汉沃德通",
      },
    ]);
    const dispatch: ProjectConfirmationDispatch = {
      id: "dispatch-1",
      confirmationId: "confirmation-1",
      sequence: 1,
      method: "COURIER",
      sentAt: "2026-07-16T06:00:00.000Z",
      trackingNumber: "OLD123",
      trackingRegisteredAt: "2026-07-16T06:01:00.000Z",
      createdBy: "user-1",
      createdAt: "2026-07-16T06:00:00.000Z",
    };

    render(
      <ConfirmationShipmentTracking
        copy={dictionary.confirmations.tracking}
        dispatch={dispatch}
        locale="zh-CN"
        onCorrectTracking={onCorrectTracking}
        searchTrackingCarriers={searchTrackingCarriers}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "更正物流" }));
    fireEvent.click(screen.getByRole("combobox", { name: "运输商" }));
    fireEvent.change(screen.getByLabelText("搜索运输商名称或代码"), {
      target: { value: "武汉" },
    });
    await waitFor(
      () => expect(searchTrackingCarriers).toHaveBeenLastCalledWith("武汉"),
      { timeout: 5000 }
    );
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /武汉沃德通/ })).toBeVisible()
    );
    fireEvent.click(screen.getByRole("option", { name: /武汉沃德通/ }));
    fireEvent.change(screen.getByLabelText("快递单号"), {
      target: { value: "R26062747635767" },
    });
    fireEvent.change(screen.getByLabelText("更正原因"), {
      target: { value: "自动识别错误" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认更正" }));

    expect(onCorrectTracking).toHaveBeenCalledWith({
      courierName: "武汉沃德通",
      reason: "自动识别错误",
      trackingCarrierCode: 191_222,
      trackingNumber: "R26062747635767",
    });
  });
});
