import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { CmpDictionary } from "@/i18n/client";

import { ClientAdditionalAddressDataGrid } from "./client-additional-address-data-grid";
import type { ClientAdditionalAddressFormRow } from "./client-additional-address-data-grid";

function expectPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present");
  }
  return value;
}

const copy = {
  action: "Action",
  cancel: "Cancel",
  clearFilters: "Clear",
  close: "Close",
  delete: "Delete",
  filter: "Filter",
  filterNoResults: "No results",
  filterSearch: "Search",
  clientFormAdditionalAddresses: "Additional Addresses",
  clientFormAddAddress: "Add Address",
  clientFormAddress: "Address",
  clientFormAddressDialogDescription: "Enter the address.",
  clientFormAddressLabel: "Address Label",
  clientFormAddressesEmpty: "No additional addresses added yet.",
  clientFormDeleteAddress: "Delete Address",
  clientFormDeleteAddressDescription: "Delete {label}?",
  clientFormDeleteAddressTitle: "Delete address?",
  clientFormEditAddress: "Edit Address",
  clientFormSaveAddress: "Save Address",
} as unknown as CmpDictionary["workspace"];
const initialAddresses: ClientAdditionalAddressFormRow[] = [
  {
    id: "address-1",
    key: "address-1",
    label: "Branch office",
    address: "18 Harbour Road, Wan Chai",
  },
  {
    id: "address-2",
    key: "address-2",
    label: "Records storage",
    address: "2 Container Port Road, Kwai Chung",
  },
];

function AddressGridHarness() {
  const [addresses, setAddresses] = useState(initialAddresses);
  return (
    <ClientAdditionalAddressDataGrid
      addresses={addresses}
      copy={copy}
      onChange={setAddresses}
    />
  );
}

describe(ClientAdditionalAddressDataGrid, () => {
  it("supports table controls and address CRUD through dialogs", () => {
    render(<AddressGridHarness />);

    const grid = screen.getByTestId("cmp-client-additional-address-data-grid");
    fireEvent.click(
      within(grid).getByRole("button", { name: "Address Label" })
    );
    expect(
      screen.getByRole("menuitem", { name: "Sort ascending" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Sort descending" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Filter" })
    ).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Address" }));
    let dialog = screen.getByRole("dialog", { name: "Add Address" });
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Address Label" }),
      { target: { value: "Tax correspondence" } }
    );
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Address" }), {
      target: { value: "8 Finance Street, Central" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save Address" })
    );
    expect(within(grid).getByText("Tax correspondence")).toBeInTheDocument();

    fireEvent.click(
      expectPresent(
        within(grid).getAllByRole("button", { name: "Edit Address" })[2]
      )
    );
    dialog = screen.getByRole("dialog", { name: "Edit Address" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Address" }), {
      target: { value: "9 Finance Street, Central" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save Address" })
    );
    expect(
      within(grid).getByText("9 Finance Street, Central")
    ).toBeInTheDocument();

    fireEvent.click(
      expectPresent(
        within(grid).getAllByRole("button", { name: "Delete Address" })[2]
      )
    );
    const alert = screen.getByRole("alertdialog", { name: "Delete address?" });
    fireEvent.click(within(alert).getByRole("button", { name: "Delete" }));
    expect(within(grid).queryByText("Tax correspondence")).toBeNull();
  });
});
