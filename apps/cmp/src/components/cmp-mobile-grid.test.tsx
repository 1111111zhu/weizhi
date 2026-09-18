import type { TmsTimesheetQueryDetailRow } from "@project-wing/shared";
import { Button, Input } from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CmpI18nProvider } from "@/i18n/client";

import { FormWizardStepper } from "./cmp-form-controls";
import {
  CmpMasterDataGrid,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";
import { CmpMobileHeader } from "./cmp-mobile-header";
import { CmpTmsTimesheetWorksheet } from "./cmp-tms-timesheet-worksheet";

type RecordRow = { id: string; name: string; status: string; hours: number };
const rows: RecordRow[] = [
  { id: "orchid", name: "Orchid audit", status: "Pending", hours: 4 },
  { id: "harbour", name: "Harbour review", status: "Approved", hours: 8 },
];
const edit = vi.fn();
const columns: ProjectWingMasterDataGridProps<RecordRow>["columns"] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    meta: { headerTitle: "Name" },
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    filterFn: cmpSelectedValuesFilter,
    meta: { headerTitle: "Status" },
  },
  {
    id: "hours",
    accessorKey: "hours",
    header: "Hours",
    meta: { headerTitle: "Hours" },
    cell: ({ row }) => (
      <Input
        aria-label={`${row.original.name} hours`}
        value={row.original.hours}
        onChange={(event) => edit(row.original.id, event.target.value)}
      />
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button onClick={() => edit(row.original.id)}>
        Edit {row.original.name}
      </Button>
    ),
    enableSorting: false,
  },
];
function viewport(phone = true) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone && query.includes("767"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
function grid(props: Partial<ProjectWingMasterDataGridProps<RecordRow>> = {}) {
  return render(
    <CmpI18nProvider initialLocale="en-US">
      <CmpMasterDataGrid
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        mobile={{
          titleColumn: "name",
          summaryColumns: ["status"],
          filterColumn: "status",
        }}
        title="Engagements"
        emptyMessage="No records"
        testId="test-grid"
        {...props}
      />
    </CmpI18nProvider>
  );
}
describe("CMP phone presentation", () => {
  beforeEach(() => {
    viewport();
    edit.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the phone worksheet monthly totals aligned with daily records", () => {
    render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpTmsTimesheetWorksheet
          rows={[
            {
              staffName: "Amy",
              timesheetDate: "2026-07-01",
              normal: 8,
              ot: 2,
              absent: 0,
              timesheetStatus: "SUBMITTED",
            } as TmsTimesheetQueryDetailRow,
            {
              staffName: "Amy",
              timesheetDate: "2026-08-01",
              normal: 4,
              ot: 1,
              absent: 0,
              timesheetStatus: "SUBMITTED",
            } as TmsTimesheetQueryDetailRow,
          ]}
        />
      </CmpI18nProvider>
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getAllByRole("definition")[0]).toHaveTextContent("4");
    const [month] = screen.getAllByRole("combobox");
    fireEvent.click(month);
    const july = screen.getByRole("option", { name: "2026-07" });
    fireEvent.pointerDown(july, { button: 0 });
    fireEvent.pointerUp(july, { button: 0 });
    fireEvent.click(july);
    expect(screen.getAllByRole("definition")[0]).toHaveTextContent("8");
    expect(screen.getAllByRole("definition")[1]).toHaveTextContent("2");
  });

  it("keeps the original filtered row model and full details/actions", () => {
    grid({ initialColumnFilters: [{ id: "status", value: ["Pending"] }] });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Orchid audit" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Harbour review" })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Record details: Orchid audit" })
    );
    const dialog = screen.getByRole("dialog", { name: "Orchid audit" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit Orchid audit" })
    );
    expect(edit).toHaveBeenCalledWith("orchid");
    expect(
      within(dialog).getByRole("textbox", { name: "Orchid audit hours" })
    ).toHaveValue("4");
  });

  it("calls the existing record-opening callback", () => {
    const onOpen = vi.fn();
    grid({ onRowClick: onOpen });
    fireEvent.click(screen.getByRole("button", { name: "Harbour review" }));
    expect(onOpen).toHaveBeenCalledWith(rows[1]);
  });

  it("changes status using the existing column filter", async () => {
    grid();
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    const pending = screen.getByRole("option", { name: "Pending" });
    fireEvent.pointerDown(pending, { button: 0 });
    fireEvent.pointerUp(pending, { button: 0 });
    fireEvent.click(pending);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Harbour review" })
      ).not.toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: "Orchid audit" })
    ).toBeInTheDocument();
  });

  it("does not offer selection for a forbidden row", async () => {
    const selection = vi.fn();
    grid({
      showRowSelection: true,
      isRowSelectable: (row) => row.id !== "harbour",
      onRowSelectionChange: selection,
    });
    fireEvent.click(screen.getByRole("button", { name: "List actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Select records" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Select records: Harbour review" })
      ).toBeDisabled()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select records: Orchid audit" })
    );
    expect(
      screen.getByRole("button", { name: "Select records: Orchid audit" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(selection).toHaveBeenCalledWith({ orchid: true });
  });

  it("retains editing callbacks when a subtable becomes a form", () => {
    render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpMasterDataGrid
          columns={columns}
          data={rows}
          mobile={{ titleColumn: "name", editable: true }}
          title="Budget"
          emptyMessage="No records"
          testId="budget"
        />
      </CmpI18nProvider>
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Orchid audit hours" }),
      { target: { value: "6" } }
    );
    expect(edit).toHaveBeenCalledWith("orchid", "6");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("preserves the desktop table", () => {
    viewport(false);
    grid();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByTestId("cmp-mobile-records")).not.toBeInTheDocument();
  });

  it("uses a step selector without changing the step callback", async () => {
    const change = vi.fn();
    render(
      <CmpI18nProvider initialLocale="en-US">
        <FormWizardStepper
          steps={[
            { id: "setup", label: "Setup", status: "complete" },
            {
              id: "review",
              label: "Review",
              status: "incomplete",
              missingCount: 2,
            },
          ]}
          activeStepId="setup"
          ariaLabel="Form steps"
          onStepChange={change}
        />
      </CmpI18nProvider>
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Form steps" }));
    const review = screen.getByRole("option", { name: /Review/ });
    fireEvent.pointerDown(review, { button: 0 });
    fireEvent.pointerUp(review, { button: 0 });
    fireEvent.click(review);
    await waitFor(() => expect(change).toHaveBeenCalledWith("review"));
  });

  it("closes navigation before calling its action", async () => {
    const open = vi.fn();
    render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpMobileHeader
          title="Client"
          onReturn={() => {}}
          searchPlaceholder="Search"
          account={<p>Account</p>}
          actions={[
            {
              id: "engagement",
              label: "Engagement",
              icon: null,
              onClick: open,
            },
          ]}
        />
      </CmpI18nProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Workspace navigation" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Engagement" }));
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
