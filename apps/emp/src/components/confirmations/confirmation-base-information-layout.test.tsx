// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ConfirmationGeneralLayout,
  ProjectConfirmationBaseInformation,
} from "../../api/client";
import { defaultConfirmationsCopy } from "../../i18n/dictionaries";
import { getConfirmationBaseInformationFallback } from "./confirmation-base-information-fallback";
import { ConfirmationBaseInformationLayout } from "./confirmation-base-information-layout";
import type { ConfirmationBaseInformationLayoutValues } from "./confirmation-base-information-layout";

const baseInformation: ProjectConfirmationBaseInformation = {
  clientNames: ["Acme"],
  references: ["REF-1"],
  banks: [{ name: "HSBC", account: "001", address: "Central" }],
  customFields: [],
};

const values: ConfirmationBaseInformationLayoutValues = {
  clientName: "Acme",
  confirmationDate: "2026-09-07",
  reference: "REF-1",
  pic: "PIC",
  mic: "MIC",
  reportDate: "2026-09-06",
  baseInformation,
};

function Harness({
  initialValues = values,
  layout,
  readOnly = false,
  isSaving = false,
}: {
  initialValues?: ConfirmationBaseInformationLayoutValues;
  layout: ConfirmationGeneralLayout;
  readOnly?: boolean;
  isSaving?: boolean;
}) {
  const [current, setCurrent] = useState(initialValues);
  return (
    <>
      <ConfirmationBaseInformationLayout
        isSaving={isSaving}
        layout={layout}
        locale="en-US"
        onChange={setCurrent}
        readOnly={readOnly}
        values={current}
      />
      <output data-testid="state">{JSON.stringify(current)}</output>
    </>
  );
}

function readState() {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}");
}

describe(ConfirmationBaseInformationLayout, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps builtin array values when its configured name changes", () => {
    render(
      <Harness
        layout={{
          sections: [
            {
              id: "clients",
              name: "Clients",
              fields: [
                {
                  id: "client-name",
                  name: "Renamed client",
                  binding: "clientName",
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByLabelText("Renamed client 1")).toHaveValue("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(readState().baseInformation.clientNames).toStrictEqual(["Acme", ""]);
  });

  it("writes active custom definitions with canonical names and values", () => {
    render(
      <Harness
        initialValues={{
          ...values,
          baseInformation: {
            ...baseInformation,
            customFields: [
              { id: "department", name: "Old name", value: "Audit" },
              { id: "removed", name: "Removed", value: "Keep on server" },
            ],
          },
        }}
        layout={{
          sections: [
            {
              id: "custom",
              name: "Project fields",
              fields: [
                { id: "department", name: "Department" },
                { id: "owner", name: "Owner" },
              ],
            },
          ],
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("Department"), {
      target: { value: "Tax" },
    });
    expect(readState().baseInformation.customFields).toStrictEqual([
      { id: "department", name: "Department", value: "Tax" },
      { id: "owner", name: "Owner", value: "" },
    ]);
  });

  it("updates bank value tuples and adds a blank tuple", () => {
    render(
      <Harness
        layout={{
          sections: [
            {
              id: "banks",
              name: "Banks",
              fields: [
                { id: "bank", name: "Bank", binding: "bankName" },
                { id: "account", name: "Account", binding: "accountNumber" },
                { id: "address", name: "Address", binding: "recipientAddress" },
              ],
            },
          ],
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("Account"), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add bank" }));
    expect(readState().baseInformation.banks).toStrictEqual([
      { name: "HSBC", account: "999", address: "Central" },
      { name: "", account: "", address: "" },
    ]);
  });
});

function phoneViewport() {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("767"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("mobile base information", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  const layout = getConfirmationBaseInformationFallback(
    defaultConfirmationsCopy,
    [{ id: "department", name: "Contact team" }]
  );

  it("groups a bank tuple with one removal action and preserves the other bank's data", () => {
    phoneViewport();
    render(<Harness layout={layout} />);
    const first = screen.getByRole("group", { name: "Bank 1" });
    expect(within(first).getByLabelText("Bank name")).toHaveValue("HSBC");
    expect(within(first).getByLabelText("Bank account")).toHaveValue("001");
    expect(within(first).getByLabelText("Mailing address").tagName).toBe(
      "TEXTAREA"
    );
    expect(within(first).queryByRole("button")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add bank" }));
    const second = screen.getByRole("group", { name: "Bank 2" });
    expect(within(second).getByLabelText("Bank name")).toHaveFocus();
    expect(within(first).getAllByRole("button")).toHaveLength(1);
    expect(within(second).getAllByRole("button")).toHaveLength(1);
    fireEvent.change(within(second).getByLabelText("Bank name"), {
      target: { value: "Second bank" },
    });
    fireEvent.change(within(second).getByLabelText("Bank account"), {
      target: { value: "002" },
    });
    fireEvent.change(within(second).getByLabelText("Mailing address"), {
      target: { value: "Floor 10\nCentral" },
    });
    fireEvent.click(
      within(first).getByRole("button", { name: "Remove Bank 1" })
    );
    expect(readState().baseInformation.banks).toStrictEqual([
      { name: "Second bank", account: "002", address: "Floor 10\nCentral" },
    ]);
    expect(screen.queryByRole("button", { name: /Remove Bank/ })).toBeNull();
  });

  it("keeps a labelled first row without a disabled removal placeholder and supports repeated values", () => {
    phoneViewport();
    render(<Harness layout={layout} />);
    expect(screen.getByLabelText("Client names 1")).toHaveValue("Acme");
    expect(screen.getByText("Client names 1")).toHaveClass("sr-only");
    expect(screen.queryByRole("button", { name: "Remove 1" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Add row" })[0]);
    expect(screen.getByLabelText("Client names 2")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Client names 2"), {
      target: { value: "Subsidiary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove 1" }));
    expect(readState().baseInformation.clientNames).toStrictEqual([
      "Subsidiary",
    ]);
    expect(readState().baseInformation.references).toStrictEqual(["REF-1"]);
  });

  it.each([{ readOnly: true }, { isSaving: true }])(
    "prevents editing and adding or removing rows when locked: %j",
    (lock) => {
      phoneViewport();
      render(
        <Harness
          layout={layout}
          {...lock}
          initialValues={{
            ...values,
            baseInformation: {
              ...baseInformation,
              banks: [
                ...baseInformation.banks,
                { name: "Second", account: "", address: "" },
              ],
            },
          }}
        />
      );
      for (const field of screen.getAllByRole("textbox")) {
        expect(field).toBeDisabled();
      }
      for (const action of screen.getAllByRole("button")) {
        expect(action).toBeDisabled();
      }
    }
  );

  it("keeps configured custom labels and legacy bindings in the mobile fallback", () => {
    phoneViewport();
    render(<Harness layout={layout} />);
    fireEvent.change(screen.getByLabelText("PIC"), {
      target: { value: "New PIC" },
    });
    fireEvent.change(screen.getByLabelText("Contact team"), {
      target: { value: "Tax" },
    });
    expect(readState().pic).toBe("New PIC");
    expect(readState().baseInformation.customFields).toStrictEqual([
      { id: "department", name: "Contact team", value: "Tax" },
    ]);
    expect(readState().baseInformation.banks).toStrictEqual(
      baseInformation.banks
    );
  });

  it("only renders configured bank fields and preserves omitted tuple values", () => {
    phoneViewport();
    render(
      <Harness
        layout={{
          sections: [
            {
              id: "bank",
              name: "Beneficiary",
              fields: [
                {
                  id: "account",
                  name: "Beneficiary account",
                  binding: "accountNumber",
                },
              ],
            },
          ],
        }}
      />
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Beneficiary account"), {
      target: { value: "007" },
    });
    expect(readState().baseInformation.banks).toStrictEqual([
      { name: "HSBC", account: "007", address: "Central" },
    ]);
  });
});
