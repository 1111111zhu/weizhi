import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxPage } from "./inbox";

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  inboxMessages: vi.fn(),
  markInboxRead: vi.fn(),
  markInboxUnread: vi.fn(),
  markAllInboxRead: vi.fn(),
  deleteInboxMessage: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: mockApi,
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    localizedPath: (pathname: string) =>
      pathname.startsWith("/acceptance") ? `/zh-CN${pathname}` : pathname,
    dictionary: {
      common: {
        back: "Back",
        unreadSuffix: "unread",
      },
      inbox: {
        title: "Message center",
        description: "Project messages are delivered here.",
        loading: "Loading messages...",
        emptyTitle: "No messages",
        emptyDescription: "No messages yet.",
        newMessage: "New",
        genericMessage: "General",
        joined: "Joined",
        expired: "Expired",
        pending: "Pending",
        allTab: "All",
        actionTab: "Action",
        reviewTab: "Review",
        signoffTab: "Sign-off",
        readTab: "Read",
        markAllRead: "Mark all as read",
        searchPlaceholder: "Search messages...",
        noSearchResults: "No matching messages",
        clearSearch: "Clear",
        hideList: "Hide",
        quickActions: "Quick actions",
        today: "Today",
        yesterday: "Yesterday",
        lastSevenDays: "Last 7 days",
        earlier: "Earlier",
        expires: "expires",
        workspaceLabel: "Workspace",
        projectLabel: "Project",
        senderLabel: "Sender",
        workingPaperLabel: "Working paper",
        reviewQuestionLabel: "Review note",
        invitedRoleLabel: "Invited role",
        expiresAtLabel: "Expires at",
        sentAt: "Sent",
        sentByAt: "sent",
        openInvitation: "Open invitation",
        openProject: "Open project",
        openWorkpaper: "Open workpaper",
        openMessageTarget: "Open",
        markRead: "Mark as read",
        markUnread: "Mark as unread",
        deleteMessage: "Delete",
        clearExpired: "Clear expired",
        summaryTitle: "Message summary",
        emptyDetail: "Select a message to view its details.",
        actionRequiredStatus: "Action required",
        unreadStatus: "Unread",
        readStatus: "Read",
        resolvedStatus: "Resolved",
        typeLabels: {
          PROJECT_INVITATION: "Invitation",
          REVIEW_QUESTION: "Review note",
          REVIEW_REPLY: "Review reply",
          REVIEW_FOLLOW_UP: "Follow-up",
          REVIEW_REOPENED: "Reopened",
          SIGNOFF: "Sign-off",
          SYSTEM_NOTIFICATION: "System",
        },
      },
    },
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe(InboxPage, () => {
    it("renders collaboration messages with project context and actions", async () => {
      setupApi();
      renderInboxPage();

      await expect(
        screen.findAllByText("Review note pending")
      ).resolves.toHaveLength(2);
      expect(
        screen.getAllByText(/AUD\s*-\s*2026\s*-\s*0001/).length
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/C-01/).length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", { name: /Mark all as read/ })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));
      await waitFor(() =>
        expect(mockApi.markAllInboxRead).toHaveBeenCalledOnce()
      );
      expect(mockApi.markAllInboxRead.mock.calls[0]?.[0]).toBeUndefined();

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() =>
        expect(mockApi.deleteInboxMessage.mock.calls[0]?.[0]).toBe(
          "message-review"
        )
      );
    }, 10_000);

    it("allows read messages to be marked unread again", async () => {
      setupApi({ readAt: "2026-06-08T08:01:00.000Z" });
      renderInboxPage();

      await expect(
        screen.findAllByText("Review note pending")
      ).resolves.toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "Mark as unread" }));

      await waitFor(() =>
        expect(mockApi.markInboxUnread.mock.calls[0]?.[0]).toBe(
          "message-review"
        )
      );
    }, 10_000);

    it("keeps the current detail message while filters show or hide the list", async () => {
      setupApi({ includeReadSystemMessage: true });
      renderInboxPage();

      const detailPane = await screen.findByTestId("inbox-detail-pane");
      await expect(
        within(detailPane).findByRole("heading", {
          name: "Review note pending",
        })
      ).resolves.toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /^Read/ }));
      expect(screen.getByTestId("inbox-message-list-scroll")).toHaveClass(
        "overflow-y-auto"
      );
      expect(screen.getByTestId("inbox-message-detail-scroll")).toHaveClass(
        "overflow-y-auto"
      );
      expect(
        screen.getByTestId("inbox-message-message-system")
      ).toBeInTheDocument();
      expect(
        within(detailPane).getByRole("heading", {
          name: "Review note pending",
        })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Hide" }));
      expect(
        screen.queryByPlaceholderText("Search messages...")
      ).not.toBeInTheDocument();
      expect(
        within(detailPane).getByRole("heading", {
          name: "Review note pending",
        })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
      expect(
        screen.getByPlaceholderText("Search messages...")
      ).toBeInTheDocument();
      expect(
        within(detailPane).getByRole("heading", {
          name: "Review note pending",
        })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("inbox-message-message-system"));
      expect(
        within(detailPane).getByRole("heading", { name: "System notice" })
      ).toBeInTheDocument();
      expect(
        within(detailPane).getByText("Workspace maintenance details.")
      ).toBeInTheDocument();
    }, 10_000);

    it("opens CMP acceptance notifications in the CMP application", async () => {
      setupApi({ includeCmpMessage: true });
      renderInboxPage();

      const detailPane = await screen.findByTestId("inbox-detail-pane");
      fireEvent.click(await screen.findByTestId("inbox-message-message-cmp"));

      expect(
        within(detailPane).getByRole("heading", { name: "Acceptance approved" })
      ).toBeInTheDocument();
      expect(
        within(detailPane).getByRole("link", { name: "Open" })
      ).toHaveAttribute(
        "href",
        "http://localhost:3002/zh-CN/acceptance?tab=requests&requestId=request-1"
      );
    }, 10_000);

    it("opens SmartForm item questions in the exact read-only preview target", async () => {
      setupApi({ smartFormReview: true });
      renderInboxPage();

      const detailPane = await screen.findByTestId("inbox-detail-pane");
      await within(detailPane).findByRole("heading", {
        name: "Review note pending",
      });
      const href = within(detailPane)
        .getByRole("link", { name: "Open project" })
        .getAttribute("href");
      const url = new URL(href ?? "", "https://emp.superfx.cn");

      expect(Object.fromEntries(url.searchParams)).toStrictEqual({
        reviewQuestionId: "question-1",
        attachmentId: "smart-form-1",
        smartFormPreview: "1",
        smartFormNodeId: "section-1",
        smartFormRowId: "row-4",
        smartFormTargetLabel: "Procedure 4",
        focus: "q",
      });
    }, 10_000);
  });

  it("classifies operational system notifications as requiring action", async () => {
    setupApi({ includeActionSystemMessage: true });
    renderInboxPage();

    const actionTab = await screen.findByRole("tab", { name: /^Action/ });
    await waitFor(() => expect(actionTab).toHaveTextContent("2"));
    fireEvent.click(actionTab);

    expect(
      screen.getByTestId("inbox-message-message-archive-reminder")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Action required").length).toBeGreaterThan(0);
  }, 10_000);

  it("opens SmartForm item questions in the exact read-only preview target", async () => {
    setupApi({ smartFormReview: true });
    renderInboxPage();

    const detailPane = await screen.findByTestId("inbox-detail-pane");
    await within(detailPane).findByRole("heading", {
      name: "Review note pending",
    });
    const href = within(detailPane)
      .getByRole("link", { name: "Open project" })
      .getAttribute("href");
    expect(href).toBeTruthy();
    if (!href) {
      throw new Error("Expected the project link to have an href");
    }
    const url = new URL(href, "https://emp.superfx.cn");

    expect(Object.fromEntries(url.searchParams)).toStrictEqual({
      reviewQuestionId: "question-1",
      attachmentId: "smart-form-1",
      smartFormPreview: "1",
      smartFormNodeId: "section-1",
      smartFormRowId: "row-4",
      smartFormTargetLabel: "Procedure 4",
      focus: "q",
    });
  }, 10_000);
});
function renderInboxPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(InboxPage)
    )
  );
}

function setupApi(
  options: {
    readAt?: string | null;
    includeReadSystemMessage?: boolean;
    includeActionSystemMessage?: boolean;
    includeCmpMessage?: boolean;
    smartFormReview?: boolean;
  } = {}
) {
  mockApi.me.mockResolvedValue({
    id: "user-staff",
    email: "staff@projectwing.local",
    name: "King Su",
    globalRole: "STAFF",
    status: "ACTIVE",
  });
  const reviewMessage = {
    id: "message-review",
    recipientId: "user-staff",
    senderId: "user-manager",
    projectId: "project-1",
    workingPaperId: "paper-1",
    reviewQuestionId: "question-1",
    type: "REVIEW_QUESTION",
    title: "Review note pending",
    body: "Please explain the bank variance.",
    actionUrl: "/engagement/project-1",
    readAt: options.readAt ?? null,
    createdAt: "2026-06-08T08:00:00.000Z",
    sender: { id: "user-manager", name: "Leo Li", email: "m@example.com" },
    project: {
      id: "project-1",
      projectCode: "AUD-2026-0001",
      name: "Orchid audit",
      workspace: {
        id: "workspace-1",
        name: "Orchid workspace",
        clientName: "Orchid",
      },
    },
    workingPaper: { id: "paper-1", code: "C-01", title: "Cash" },
    reviewQuestion: {
      id: "question-1",
      workingPaperId: "paper-1",
      attachmentId: options.smartFormReview ? "smart-form-1" : null,
      smartFormNodeId: options.smartFormReview ? "section-1" : null,
      smartFormRowId: options.smartFormReview ? "row-4" : null,
      smartFormTargetLabel: options.smartFormReview ? "Procedure 4" : null,
      status: "OPEN",
      body: "Please explain the bank variance.",
      assignedTo: {
        id: "user-staff",
        name: "King Su",
        email: "staff@example.com",
      },
      createdBy: {
        id: "user-manager",
        name: "Leo Li",
        email: "m@example.com",
      },
    },
    projectInvitation: null,
  };
  const messages: unknown[] = [reviewMessage];

  if (options.includeReadSystemMessage) {
    messages.push({
      ...reviewMessage,
      id: "message-system",
      senderId: null,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "SYSTEM_NOTIFICATION",
      title: "System notice",
      body: "Workspace maintenance details.",
      actionUrl: "/engagement/project-1/settings",
      readAt: "2026-06-08T09:00:00.000Z",
      createdAt: "2026-06-08T09:00:00.000Z",
      sender: null,
      workingPaper: null,
      reviewQuestion: null,
    });
  }

  if (options.includeCmpMessage) {
    messages.push({
      ...reviewMessage,
      id: "message-cmp",
      senderId: null,
      projectId: null,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "SYSTEM_NOTIFICATION",
      title: "Acceptance approved",
      body: "The CMP acceptance request was approved.",
      actionUrl: "/cmp/acceptance?tab=requests&requestId=request-1",
      readAt: null,
      sender: null,
      project: null,
      workingPaper: null,
      reviewQuestion: null,
    });
  }

  if (options.includeActionSystemMessage) {
    messages.push({
      ...reviewMessage,
      id: "message-archive-reminder",
      senderId: null,
      workingPaperId: null,
      reviewQuestionId: null,
      type: "SYSTEM_NOTIFICATION",
      title: "Archive deadline reminder: AUD-2026-0001",
      body: "The archive deadline is in five days.",
      contentKey: "PROJECT_ARCHIVE_DEADLINE_REMINDER",
      contentParams: null,
      actionUrl: "/engagement/project-1",
      readAt: null,
      sender: null,
      project: null,
      workingPaper: null,
      reviewQuestion: null,
    });
  }

  mockApi.inboxMessages.mockResolvedValue(messages);
  mockApi.markInboxRead.mockResolvedValue({});
  mockApi.markInboxUnread.mockResolvedValue({});
  mockApi.markAllInboxRead.mockResolvedValue({
    count: 1,
    readAt: "2026-06-08T08:01:00.000Z",
  });
  mockApi.deleteInboxMessage.mockResolvedValue({ id: "message-review" });
}
