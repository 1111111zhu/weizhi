import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectAttachment, WorkingPaperQuestion } from "../api/client";
import type { ProjectReviewQuestionItem } from "./project-review-questions-dialog";
import { WorkbenchReviewNotesPanel } from "./workbench-review-notes-panel";
import type { WorkbenchReviewNotesPanelCopy } from "./workbench-review-notes-types";

vi.mock("./workbench-paper-section", () => ({
  ReviewQuestionsPanel: ({
    initialQuestionId,
    startInCreateMode,
  }: {
    initialQuestionId?: string;
    startInCreateMode?: boolean;
  }) => (
    <div data-testid="review-question-dialog-controller">
      {startInCreateMode ? "create" : initialQuestionId}
    </div>
  ),
}));

describe("lint test setup", () => {
  afterEach(() => cleanup());

  const copy: WorkbenchReviewNotesPanelCopy = {
    title: "Review notes",
    projectScopeTitle: "All project review notes",
    showAllProjectNotes: "View all project notes",
    resizeLabel: "Resize review notes panel",
    counts: {
      all: "All",
      open: "Open",
      replied: "Replied",
      cleared: "Cleared",
    },
    filters: {
      search: "Search notes",
      subject: "Search subject",
      reference: "Search reference",
      createdBy: "Created by",
      assignedTo: "Assigned to",
      status: "Status",
      allCreators: "All creators",
      allAssignees: "All assignees",
      allStatuses: "All statuses",
      clear: "Clear filters",
    },
    columns: {
      actions: "Actions",
      file: "File",
      subject: "Subject",
      reference: "Reference",
      createdBy: "Created by",
      createdOn: "Created on",
      assignedTo: "Assigned to",
      status: "Status",
    },
    columnMenu: {
      clear: "Clear filter",
      empty: "No values found",
      filter: "Filter",
      search: "Search",
    },
    statusLabels: {
      OPEN: "Open",
      REPLIED: "Replied",
      CLEARED: "Cleared",
    },
    unassigned: "Unassigned",
    locate: "Locate file",
    view: "View note",
    newReviewNote: "New review note",
    emptyTitle: "No review notes for this file",
    emptyDescription: "Create a review note for the selected file.",
    projectEmptyTitle: "No review notes in this project",
    projectEmptyDescription: "Project review notes appear here.",
    noMatches: "No review notes match the current filters.",
    noSelectionTitle: "No file selected",
    noSelectionDescription: "Choose a file from the Notes column.",
    unavailableTitle: "File unavailable",
    unavailableDescription: "Choose another file from the Notes column.",
  };
  const reviewQuestionsCopy = {
    statusLabels: copy.statusLabels,
    projectRoleLabels: {
      PARTNER: "Partner",
      REVIEWER: "Reviewer",
      PREPARER: "Preparer",
      EQCR: "Engagement quality reviewer",
      TAX_REVIEWER: "Tax reviewer",
    },
    dialogTitle: "Notes / Review notes",
    totalCount: "{count} total",
    unresolvedCount: "{count} unresolved",
    newReviewNote: "New review note",
    newButton: "New",
    listTitle: "Review notes",
    openTab: "Open",
    repliedTab: "Replied",
    resolvedTab: "Resolved",
    emptyTitle: "No review notes yet",
    emptyDescription: "Create one to start the conversation.",
    createPlaceholder: "Describe what needs to be supplemented",
    removeAttachment: "Remove {name}",
    assignRespondent: "Assign respondent",
    adding: "Adding...",
    addReviewNote: "Add review note",
    workingPaper: "Working paper",
    reopenPlaceholder: "Explain why this review note should be reopened...",
    followUpPlaceholder: "Add a follow-up...",
    messagePlaceholder: "Type a message...",
    clear: "Clear",
    markReplied: "Mark replied",
    uploading: "Uploading...",
    send: "Send",
    reopen: "Reopen",
    selectPrompt: "Select a question or create a new one",
    clearConfirmTitle: "Clear review note",
    clearConfirmDescription: "Mark the note as resolved.",
    clearConfirmLabel: "Clear",
    cancel: "Cancel",
    back: "Back",
    close: "Close",
    createAttachmentUploadFailedToast:
      "Review note created, but attachment upload failed",
    createAttachmentUploadFailed:
      "Review note was created, but attachment upload failed.",
    attachmentLimit: "Each message can include up to {count} attachments.",
    attachmentTypeUnsupported: "This attachment type is not supported.",
    attachmentTooLarge: "Attachment must be 25 MB or smaller.",
    attachmentRemaining:
      "Only {count} more attachment(s) can be added to this message.",
    imageUploadFailed: "Image upload failed.",
    unassigned: "Unassigned",
    unknown: "Unknown",
    currentUser: "Current user",
    raisedBy: "Raised by {name}",
    assignedTo: "Assigned to {name}",
    initiatorLabel: "Initiator: {name}",
    assigneeLabel: "Assignee: {name}",
    loadingImage: "Loading image",
    imageUnavailable: "Image unavailable",
    reviewNoteContent: "Review note content",
    attachImage: "Attach file",
    message: "Message",
    retry: "Retry",
    draft: "Draft",
    noMessagesYet: "No more messages",
    currentDiscussionOnly: "Only this review note's discussion is shown.",
    noWorkpapersAvailable: "No workpapers available",
    sending: "Sending",
    referenceWorkpaper: "Reference workpaper",
    editor: {
      formattingToolbar: "Formatting toolbar",
      paragraph: "Paragraph",
      heading2: "Heading 2",
      heading3: "Heading 3",
      bold: "Bold",
      italic: "Italic",
      underline: "Underline",
      strikethrough: "Strikethrough",
      inlineCode: "Inline code",
      bulletList: "Bullet list",
      numberedList: "Numbered list",
      quote: "Quote",
      mention: "Mention",
      link: "Link",
      attachImage: "Attach file",
    },
  };

  function question(
    id: string,
    status: WorkingPaperQuestion["status"],
    body: string,
    smartFormTargetLabel?: string
  ): WorkingPaperQuestion {
    return {
      id,
      projectId: "project-1",
      workingPaperId: "paper-1",
      attachmentId: "attachment-1",
      body,
      status,
      assignedToId: null,
      createdById: "user-1",
      createdAt: "2026-08-19T08:30:00.000Z",
      updatedAt: "2026-08-19T08:30:00.000Z",
      createdBy: {
        id: "user-1",
        name: "Jony Ma",
        email: "jony@example.com",
      },
      smartFormTargetLabel,
    };
  }

  function renderPanel(
    node: ReactNode,
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  ) {
    return render(
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    );
  }

  describe(WorkbenchReviewNotesPanel, () => {
    it("shows file-level counts, Smart Form location, filters, and opens a note", () => {
      const onShowAll = vi.fn();
      renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={{
            key: "attachment:attachment-1",
            kind: "attachment",
            attachmentId: "attachment-1",
            paperId: "paper-1",
            workflowNodeId: "node-1",
            bucket: "CURRENT",
            reference: "1400.10",
            displayName: "Going concern assessment.xlsx",
            questions: [
              question("question-open", "OPEN", "Need to review"),
              question(
                "question-cleared",
                "CLEARED",
                "Check conclusion",
                "Revenue row 4"
              ),
            ],
          }}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onShowAll={onShowAll}
          onChanged={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /All/ })).toHaveTextContent(
        "2"
      );
      expect(screen.getByRole("button", { name: /Open/ })).toHaveTextContent(
        "1"
      );
      const columnLabels = screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent ?? "");
      expect(columnLabels.indexOf("Reference")).toBe(
        columnLabels.indexOf("Actions") + 1
      );
      expect(columnLabels.indexOf("File")).toBe(
        columnLabels.indexOf("Reference") + 1
      );
      expect(screen.getAllByText("Going concern assessment.xlsx")).toHaveLength(
        2
      );

      const statusHeader = screen.getByRole("columnheader", { name: "Status" });
      fireEvent.click(
        within(statusHeader).getByRole("button", { name: "Status" })
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
      fireEvent.keyDown(document, { key: "Escape" });

      fireEvent.click(
        screen.getByRole("button", { name: "View all project notes" })
      );
      expect(onShowAll).toHaveBeenCalledOnce();

      fireEvent.change(screen.getByPlaceholderText("Search notes"), {
        target: { value: "Need" },
      });
      expect(screen.getByText("Need to review")).toBeInTheDocument();
      expect(screen.queryByText("Check conclusion")).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "View note: Need to review" })
      );
      expect(
        screen.getByTestId("review-question-dialog-controller")
      ).toHaveTextContent("question-open");
    });

    it("shows all project notes when the panel opens before a file is selected", () => {
      renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={null}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[
            {
              id: "node-1",
              code: "1400",
              title: "General audit procedures",
              level: 1,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-1",
                  projectId: "project-1",
                  workflowNodeId: "node-1",
                  code: "1400.10",
                  title: "Going concern assessment",
                  paperType: "WORKING_PAPER",
                  attachments: [
                    {
                      id: "attachment-1",
                      workingPaperId: "paper-1",
                      workflowNodeId: "node-1",
                      bucket: "CURRENT",
                      code: "1400.10-F001",
                      title: "Going concern assessment",
                      fileKind: "SUPPORTING",
                      fileName: "going-concern.xlsx",
                      fileUrl: "/files/going-concern.xlsx",
                      fileSize: 1024,
                      mimeType:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      version: 1,
                      reviewQuestions: [
                        question(
                          "project-question",
                          "OPEN",
                          "Project-wide note"
                        ),
                      ],
                    },
                  ],
                },
              ],
            },
          ]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onShowAll={vi.fn()}
          onChanged={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", { name: "Review notes" })
      ).toBeInTheDocument();
      expect(
        screen.queryByText("All project review notes")
      ).not.toBeInTheDocument();
      expect(screen.getByText("Project-wide note")).toBeInTheDocument();
      expect(screen.getByText("1400.10-F001")).toBeInTheDocument();
      expect(screen.getByText("Going concern assessment")).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "View note: Project-wide note" })
      );
      expect(
        screen.getByTestId("review-question-dialog-controller")
      ).toHaveTextContent("project-question");
    });

    it("locates an attachment note before opening it", () => {
      const onLocateQuestion = vi.fn<
        (item: ProjectReviewQuestionItem) => boolean
      >(() => true);
      const attachmentQuestion = question(
        "question-attachment",
        "OPEN",
        "Attachment note"
      );
      renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={null}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[
            {
              id: "node-1",
              code: "1400",
              title: "General audit procedures",
              level: 1,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-1",
                  projectId: "project-1",
                  workflowNodeId: "node-1",
                  code: "1400.10",
                  title: "Going concern assessment",
                  paperType: "WORKING_PAPER",
                  attachments: [
                    {
                      id: "attachment-1",
                      workingPaperId: "paper-1",
                      workflowNodeId: "node-1",
                      bucket: "CURRENT",
                      code: "1400.10-F001",
                      title: "Going concern assessment",
                      fileKind: "SUPPORTING",
                      fileName: "going-concern.xlsx",
                      fileUrl: "/files/going-concern.xlsx",
                      fileSize: 1024,
                      mimeType:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      version: 1,
                      reviewQuestions: [attachmentQuestion],
                    },
                  ],
                },
              ],
            },
          ]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onLocateQuestion={onLocateQuestion}
          onChanged={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText("Attachment note"));
      expect(onLocateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.objectContaining({ id: "question-attachment" }),
          paper: expect.objectContaining({ id: "paper-1" }),
          attachment: expect.objectContaining({ id: "attachment-1" }),
        })
      );
      expect(
        screen.queryByTestId("review-question-dialog-controller")
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "View note: Attachment note" })
      );
      expect(onLocateQuestion).toHaveBeenCalledTimes(2);
      expect(
        screen.getByTestId("review-question-dialog-controller")
      ).toHaveTextContent("question-attachment");
    });

    it("locates a workpaper note and opens notes with an unavailable target", () => {
      const onLocateQuestion = vi.fn<
        (item: ProjectReviewQuestionItem) => boolean
      >(() => true);
      const workpaperQuestion = {
        ...question("question-workpaper", "OPEN", "Workpaper note"),
        attachmentId: undefined,
      };
      renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={null}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[
            {
              id: "node-1",
              code: "1400",
              title: "General audit procedures",
              level: 1,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-1",
                  projectId: "project-1",
                  workflowNodeId: "node-1",
                  code: "1400.10",
                  title: "Going concern assessment",
                  paperType: "WORKING_PAPER",
                  reviewQuestions: [workpaperQuestion],
                },
              ],
            },
          ]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onLocateQuestion={onLocateQuestion}
          onChanged={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText("Workpaper note"));
      expect(onLocateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.objectContaining({ id: "question-workpaper" }),
          paper: expect.objectContaining({ id: "paper-1" }),
        })
      );
      expect(onLocateQuestion.mock.calls[0][0]?.attachment).toBeUndefined();
    });

    it("opens a project note when its target can no longer be located", () => {
      const onLocateQuestion = vi.fn(() => false);
      renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={null}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[
            {
              id: "node-1",
              code: "1400",
              title: "General audit procedures",
              level: 1,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-1",
                  projectId: "project-1",
                  workflowNodeId: "node-1",
                  code: "1400.10",
                  title: "Going concern assessment",
                  paperType: "WORKING_PAPER",
                  reviewQuestions: [
                    {
                      ...question(
                        "question-missing",
                        "OPEN",
                        "Missing target note"
                      ),
                      attachmentId: undefined,
                    },
                  ],
                },
              ],
            },
          ]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onLocateQuestion={onLocateQuestion}
          onChanged={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText("Missing target note"));
      expect(onLocateQuestion).toHaveBeenCalledOnce();
      expect(
        screen.getByTestId("review-question-dialog-controller")
      ).toHaveTextContent("question-missing");
    });

    it("includes workpaper and attachment review notes in the project-wide summary", () => {
      const attachmentQuestion = question(
        "attachment-question",
        "OPEN",
        "Attachment-level note"
      );
      const attachment: ProjectAttachment = {
        id: "attachment-1",
        workingPaperId: "paper-1",
        workflowNodeId: "node-1",
        bucket: "CURRENT",
        code: "1400.10-F001",
        title: "Supporting schedule",
        fileKind: "SUPPORTING",
        fileName: "supporting-schedule.xlsx",
        originalName: "Supporting schedule.xlsx",
        fileUrl: "/files/supporting-schedule.xlsx",
        fileSize: 1024,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
        reviewQuestions: [attachmentQuestion],
        workingPaper: {
          id: "paper-1",
          code: "1400.10",
          title: "Going concern assessment",
          bucket: "CURRENT",
          workflowNodeId: "node-1",
          workflowNodeCode: "1400",
          workflowNodeTitle: "General audit procedures",
          path: [
            {
              id: "node-1",
              code: "1400",
              title: "General audit procedures",
              level: 1,
            },
          ],
        },
      };

      renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={null}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[
            {
              id: "node-1",
              code: "1400",
              title: "General audit procedures",
              level: 1,
              nodeType: "FOLDER",
              workingPapers: [
                {
                  id: "paper-1",
                  projectId: "project-1",
                  workflowNodeId: "node-1",
                  code: "1400.10",
                  title: "Going concern assessment",
                  paperType: "WORKING_PAPER",
                  reviewQuestions: [
                    question(
                      "legacy-workpaper-question",
                      "OPEN",
                      "Legacy workpaper note"
                    ),
                  ],
                },
              ],
            },
          ]}
          attachments={[attachment]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onChanged={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /All/ })).toHaveTextContent(
        "2"
      );
      expect(screen.getByText("Attachment-level note")).toBeInTheDocument();
      expect(screen.getByText("Legacy workpaper note")).toBeInTheDocument();
      expect(screen.getByText("1400.10-F001")).toBeInTheDocument();
      expect(screen.getByText("Supporting schedule.xlsx")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: "View note: Attachment-level note",
        })
      );
      expect(
        screen.getByTestId("review-question-dialog-controller")
      ).toHaveTextContent("attachment-question");
    });

    it("opens create mode for editable files and hides mutation actions in read-only mode", () => {
      const target = {
        key: "attachment:attachment-1",
        kind: "attachment" as const,
        attachmentId: "attachment-1",
        paperId: "paper-1",
        workflowNodeId: "node-1",
        bucket: "CURRENT" as const,
        reference: "1400.10",
        displayName: "Memo.docx",
        questions: [],
      };
      const { rerender } = renderPanel(
        <WorkbenchReviewNotesPanel
          projectId="project-1"
          target={target}
          unavailableTarget={null}
          currentUserId={null}
          currentProjectRole="PARTNER"
          workflow={[]}
          locale="en-US"
          readOnly={false}
          copy={copy}
          reviewQuestionsCopy={reviewQuestionsCopy}
          onShowAll={vi.fn()}
          onChanged={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "New review note" }));
      expect(
        screen.getByTestId("review-question-dialog-controller")
      ).toHaveTextContent("create");

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <WorkbenchReviewNotesPanel
            projectId="project-1"
            target={target}
            unavailableTarget={null}
            currentUserId={null}
            currentProjectRole="PARTNER"
            workflow={[]}
            locale="en-US"
            readOnly
            copy={copy}
            reviewQuestionsCopy={reviewQuestionsCopy}
            onShowAll={vi.fn()}
            onChanged={vi.fn()}
          />
        </QueryClientProvider>
      );

      expect(
        screen.queryByRole("button", { name: "New review note" })
      ).not.toBeInTheDocument();
    });
  });
});
