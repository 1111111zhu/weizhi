import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConfirmationResponseRoutingSheet,
  typeLabel,
} from "./confirmation-response-routing-sheet";

// @vitest-environment jsdom

const mockApi = vi.hoisted(() => ({
  projects: vi.fn(),
  projectConfirmations: vi.fn(),
  routeConfirmationResponseLibraryFile: vi.fn(),
}));

vi.mock("@/api/client", () => ({ api: mockApi }));
const mockNavigation = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: mockNavigation.toast }),
}));

describe("lint test setup", () => {
  afterEach(cleanup);

  describe("confirmation response routing labels", () => {
    it("labels an unclassified confirmation in both supported locales", () => {
      expect(typeLabel("UNCLASSIFIED", true)).toBe("未归类");
      expect(typeLabel("UNCLASSIFIED", false)).toBe("Unclassified");
    });

    it("links deferred matching to the project unmatched queue", async () => {
      mockApi.projects.mockResolvedValue([{id:"project-1", name:"Orchid Audit", projectCode:"AUD-001", status:"ACTIVE"}]);
      mockApi.projectConfirmations.mockResolvedValue([]);
      mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({id: "response-1", projectId: "project-1", routingStatus: "PENDING_MATCH"});
      render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
        <ConfirmationResponseRoutingSheet open onOpenChange={vi.fn()} locale="en-US"
          response={{id:"response-1", respondingEntity:"Bank", routingStatus:"PENDING_MATCH"} as never} />
      </QueryClientProvider>);
      fireEvent.click(await screen.findByText("Orchid Audit"));
      fireEvent.click(screen.getByRole("button", {name:"Continue"}));
      fireEvent.click(screen.getByRole("button", {name:"Continue"}));
      fireEvent.click(await screen.findByRole("button", {name:"Confirm"}));
      await waitFor(() => expect(mockNavigation.toast.mock.lastCall?.[0].actions?.[0].label).toBe("Go to unmatched responses"));
      const notification = mockNavigation.toast.mock.lastCall?.[0];
      expect(notification).toMatchObject({duration:5000, closeButton:true, dismissOnNavigation:true});
      const assign = vi.fn();
      vi.stubGlobal("window", {location:{assign}});
      try {
        notification.actions[0].onClick();
        expect(assign).toHaveBeenCalledWith("/en-US/engagement/project-1?workspace=confirmations&confirmationView=unmatched");
      } finally { vi.unstubAllGlobals(); }
    });

    it("does not offer deferred matching inside a project", async () => {
      mockApi.projects.mockResolvedValue([]);
      mockApi.projectConfirmations.mockResolvedValue([]);

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <ConfirmationResponseRoutingSheet
            response={null}
            open
            onOpenChange={vi.fn()}
            locale="en-US"
            initialProjectId="project-1"
          />
        </QueryClientProvider>
      );

      await expect(
        screen.findByText("Match an outgoing confirmation")
      ).resolves.toBeVisible();
      expect(screen.getAllByRole("radio")).toHaveLength(1);
      expect(screen.queryByText("No outgoing request")).not.toBeInTheDocument();
    });

    it("offers no outgoing request only from the project matching queue", async () => {
      mockApi.projects.mockResolvedValue([]);
      mockApi.projectConfirmations.mockResolvedValue([]);

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <ConfirmationResponseRoutingSheet
            response={{id:"pending", routingStatus:"PENDING_MATCH", respondingEntity:"Bank"} as never}
            open
            onOpenChange={vi.fn()}
            locale="en-US"
            initialProjectId="project-1"
            allowNoSourceRequest
          />
        </QueryClientProvider>
      );

      await expect(
        screen.findByText("No outgoing request")
      ).resolves.toBeVisible();
      expect(screen.getAllByRole("radio")).toHaveLength(2);
      expect(screen.getByRole("radio", {name:/Match an outgoing confirmation/})).toBeChecked();
      expect(screen.queryByText("Assign to project, match later")).not.toBeInTheDocument();
    });

    it("selects a project and an outgoing confirmation before routing a response", async () => {
      mockApi.projects.mockResolvedValue([
        {
          id: "project-1",
          name: "Orchid Audit",
          projectCode: "AUD-001",
          status: "ACTIVE",
          cmpClient: { nameZh: "Orchid Holdings", nameEn: "Orchid Holdings" },
        },
      ]);
      mockApi.projectConfirmations.mockResolvedValue([
        {
          id: "confirmation-1",
          displayName: "HSBC Hong Kong",
          counterpartyName: "HSBC Hong Kong",
          respondingEntityName: "HSBC Hong Kong",
          confirmationCode: "AUD-001-001",
          preparedDispatchReference: null,
          status: "AWAITING_RESPONSE",
          type: "BANK",
        },
      ]);
      mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({
        id: "response-1",
        projectId: "project-1",
        confirmationId: "confirmation-1",
        routingStatus: "MATCHED",
      });
      const onRouted = vi.fn();
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <ConfirmationResponseRoutingSheet
            response={
              {
                id: "response-1",
                title: "Incoming response",
                projectId: null,
                referenceNumber: "AUD-001-001",
                respondingEntity: "HSBC Hong Kong",
                routingStatus: "UNASSIGNED_PROJECT",
              } as never
            }
            open
            onOpenChange={vi.fn()}
            locale="en-US"
            onRouted={onRouted}
          />
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByText("Orchid Audit"));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      fireEvent.click(await screen.findByText("Match an outgoing confirmation"));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      const routingSheet = await screen.findByRole("dialog");
      const candidateTable = within(routingSheet).getByRole("table", {
        name: "Select the outgoing confirmation",
      });
      expect(within(candidateTable).getByRole("columnheader", { name: "Confirmation" })).toBeVisible();
      expect(within(candidateTable).getByRole("columnheader", { name: "Reference number" })).toBeVisible();
      fireEvent.click(within(routingSheet).getByText("HSBC Hong Kong"));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

      await waitFor(() =>
        expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith(
          "response-1",
          {
            action: "MATCH_CONFIRMATION",
            projectId: "project-1",
            confirmationId: "confirmation-1",
          }
        )
      );
      expect(onRouted).toHaveBeenCalledWith(
        expect.objectContaining({ confirmationId: "confirmation-1" }),
        "MATCH_CONFIRMATION"
      );
      const notification = mockNavigation.toast.mock.lastCall?.[0];
      expect(notification).toMatchObject({ duration: 5000, closeButton: true, dismissOnNavigation: true });
      expect(notification.actions[0].label).toBe("Go to confirmation");
      const assign = vi.fn();
      vi.stubGlobal("window", { location: { assign } });
      try {
        notification.actions[0].onClick();
        expect(assign).toHaveBeenCalledWith(
          "/en-US/engagement/project-1?workspace=confirmations&confirmationId=confirmation-1&confirmationStage=draft"
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("searches unreceived drafts and filters categories from the project pending queue", async () => {
      mockApi.projects.mockResolvedValue([]);
      mockApi.projectConfirmations.mockResolvedValue([
        { id: "draft", status: "DRAFT", type: "BANK", confirmationCode: "ABC-001", counterpartyName: "Draft Bank" },
        { id: "frozen", status: "PREPARED", type: "LAWYER", confirmationCode: "LAW-002", counterpartyName: "Smith Legal", dispatches: [{ trackingNumber: "SF123456" }, { trackingNumber: "JD987654" }] },
        { id: "received", status: "RESPONSE_RECEIVED", type: "BANK", counterpartyName: "Received bank", dispatches: [{ trackingNumber: "SF123456" }] },
        { id: "closed", status: "CLOSED", type: "BANK", counterpartyName: "Closed bank" },
        { id: "void", status: "VOIDED", type: "BANK", counterpartyName: "Deleted bank" },
        { id: "waiting", status: "AWAITING_RESPONSE", type: "BANK", counterpartyName: "Waiting bank" },
        { id: "linked", status: "AWAITING_RESPONSE", type: "BANK", counterpartyName: "Linked bank", responses: [{ responseStatus: "RECEIVED", routingStatus: "ROUTED" }] },
      ]);
      mockApi.routeConfirmationResponseLibraryFile.mockResolvedValue({ id: "pending", routingStatus: "MATCHED" });
      render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
        <ConfirmationResponseRoutingSheet open onOpenChange={vi.fn()} locale="en-US" initialProjectId="project-1"
          response={{id:"pending", routingStatus:"PENDING_MATCH", respondingEntity:"Draft Bank"} as never} />
      </QueryClientProvider>);
      fireEvent.click(await screen.findByText("Match an outgoing confirmation"));
      fireEvent.click(screen.getByRole("button", {name:"Continue"}));
      expect(await screen.findByText("Waiting bank")).toBeVisible();
      expect(screen.queryByText("Draft Bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Smith Legal")).not.toBeInTheDocument();
      expect(screen.queryByText("Linked bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Received bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Closed bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Deleted bank")).not.toBeInTheDocument();
      const search = screen.getByRole("textbox", {name:"Search confirmation number, counterparty or outgoing tracking number"});
      for (const trackingNumber of [" sf123456 ", "987654"]) {
        fireEvent.change(search, {target:{value:trackingNumber}});
        expect(screen.getByText("Smith Legal")).toBeVisible();
        expect(screen.queryByText("Waiting bank")).not.toBeInTheDocument();
        expect(screen.queryByText("Received bank")).not.toBeInTheDocument();
      }
      fireEvent.change(search, {target:{value:"abc-001"}});
      expect(screen.getByText("Draft Bank")).toBeVisible();
      expect(screen.queryByText("Smith Legal")).not.toBeInTheDocument();
      fireEvent.change(search, {target:{value:"smith"}});
      expect(screen.getByText("Smith Legal")).toBeVisible();
      fireEvent.change(search, {target:{value:"bank"}});
      expect(screen.getByText("Closed bank")).toBeVisible();
      expect(screen.getByText("Deleted bank")).toBeVisible();
      expect(screen.queryByText("Received bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Linked bank")).not.toBeInTheDocument();
      fireEvent.change(search, {target:{value:"   "}});
      expect(screen.getByText("Waiting bank")).toBeVisible();
      expect(screen.queryByText("Draft Bank")).not.toBeInTheDocument();
      fireEvent.change(search, {target:{value:""}});
      const ui = userEvent.setup();
      await ui.click(screen.getByRole("combobox", {name:"Confirmation category"}));
      await ui.click(await screen.findByRole("option", {name:"Bank"}));
      expect(screen.getByRole("combobox", {name:"Confirmation category"})).toHaveTextContent("Bank");
      expect(screen.getByText("Closed bank")).toBeVisible();
      expect(screen.getByText("Deleted bank")).toBeVisible();
      expect(screen.queryByText("Received bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Linked bank")).not.toBeInTheDocument();
      expect(screen.queryByText("Smith Legal")).not.toBeInTheDocument();
      fireEvent.change(search, {target:{value:"smith"}});
      expect(screen.queryByText("Smith Legal")).not.toBeInTheDocument();
      fireEvent.change(search, {target:{value:""}});
      await ui.click(screen.getByRole("combobox", {name:"Confirmation category"}));
      await ui.click(await screen.findByRole("option", {name:"All categories"}));
      expect(screen.getByText("Waiting bank")).toBeVisible();
      expect(screen.queryByText("Draft Bank")).not.toBeInTheDocument();
      fireEvent.change(search, {target:{value:"abc-001"}});
      fireEvent.click(screen.getByText("Draft Bank"));
      fireEvent.change(search, {target:{value:""}});
      expect(screen.getByRole("button", {name:"Confirm"})).toBeDisabled();
      fireEvent.change(search, {target:{value:"abc-001"}});
      fireEvent.click(screen.getByRole("button", {name:"Confirm"}));
      await waitFor(()=>expect(mockApi.routeConfirmationResponseLibraryFile).toHaveBeenCalledWith("pending", {
        action:"MATCH_CONFIRMATION", projectId:"project-1", confirmationId:"draft",
      }));
    });

    it("does not offer the retired unclassified category for new routing", async () => {
      mockApi.projects.mockResolvedValue([]);
      mockApi.projectConfirmations.mockResolvedValue([]);

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <ConfirmationResponseRoutingSheet
            response={null}
            open
            onOpenChange={vi.fn()}
            locale="en-US"
            initialProjectId="project-1"
            allowNoSourceRequest
          />
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByText("No outgoing request"));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      await expect(
        screen.findByText("Provisional category")
      ).resolves.toBeVisible();
      const category = screen.getByRole("combobox", { name: "Provisional category" });
      expect(category).toHaveTextContent("Other");
      fireEvent.click(category);

      expect(screen.queryByText("Unclassified")).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("option", { name: "Other" })).toBeVisible());
      await userEvent.setup().click(screen.getByRole("option", { name: "Bank" }));
      await waitFor(() => expect(category).toHaveTextContent("Bank"));
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    });
  });
});
