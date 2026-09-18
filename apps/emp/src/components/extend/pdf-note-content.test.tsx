// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PdfNoteContent,
  PdfNoteProjectContext,
  safePdfNoteLink,
} from "./pdf-note-content";

const preview = vi.hoisted(() => vi.fn());
const reviewDownload = vi.hoisted(() => vi.fn());
const attachmentDownload = vi.hoisted(() => vi.fn());
const openPreview = vi.hoisted(() =>
  vi.fn(async ({ loadBlob }: { loadBlob: () => Promise<Blob> }) => {
    await loadBlob();
    return true;
  })
);
vi.mock("@/api/client", () => ({
  api: {
    previewAttachmentContent: preview,
    previewAttachmentPdf: preview,
    downloadReviewQuestionImage: reviewDownload,
    downloadAttachment: attachmentDownload,
  },
}));
vi.mock("@/lib/open-preview-window", () => ({
  openAuthorizedPreviewWindow: openPreview,
}));
vi.mock("@/i18n/client", () => ({ useI18n: () => ({ locale: "zh-CN" }) }));
const content = (blocks: unknown[]) => ({
  projectWingNote: {
    version: 1,
    document: { type: "doc", version: 1, content: blocks },
  },
});

const reviewContent = (label: string, id = "resource/a") => ({
  projectWingReview: {
    version: 1,
    questions: [
      {
        id: "q1",
        status: "Awaiting reply",
        messages: [
          {
            id: "m1",
            kind: "QUESTION",
            author: "Reviewer",
            date: "2026-09-10",
            body: "Evidence",
            images: [{ id, label }],
            references: [],
          },
        ],
      },
    ],
  },
});

function renderReviewFile(label: string) {
  return render(
    <PdfNoteProjectContext.Provider value="project-a">
      <PdfNoteContent custom={reviewContent(label)} text="fallback" />
    </PdfNoteProjectContext.Provider>
  );
}

describe("PDF note presentation", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    preview.mockReset();
    reviewDownload.mockReset();
    attachmentDownload.mockReset();
    openPreview.mockClear();
  });

  it.each([
    [
      "3. PRC Bank Confirmation (Template 2)(1).docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["REPORT.PDF", "application/pdf"],
    [
      "accounts.XLSX",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    [
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ])(
    "opens legacy uploaded %s as the original file, not an image or fake PDF",
    async (fileName, mimeType) => {
      reviewDownload.mockResolvedValue(
        new Blob(["fixture"], { type: "application/octet-stream" })
      );
      renderReviewFile(fileName);
      expect(reviewDownload).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: fileName }));
      expect(reviewDownload).toHaveBeenCalledWith("project-a", "resource%2Fa");
      expect(preview).not.toHaveBeenCalled();
      expect(openPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName,
          mimeType,
          loadBlob: expect.any(Function),
        })
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  );

  it("keeps legacy image downloads separate from ordinary attachment IDs and checks returned MIME", async () => {
    reviewDownload.mockResolvedValue(
      new Blob(["not an image"], { type: "application/pdf" })
    );
    renderReviewFile("evidence.PNG");
    await userEvent.click(screen.getByRole("button", { name: "evidence.PNG" }));
    await screen.findByRole("button", { name: "重试" });
    expect(reviewDownload).toHaveBeenCalledWith("project-a", "resource%2Fa");
    expect(preview).not.toHaveBeenCalled();
    expect(openPreview).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("loads an actual image from the legacy review resource route only after clicking", async () => {
    reviewDownload.mockResolvedValue(
      new Blob(["image"], { type: "image/png" })
    );
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:review-image"),
      revokeObjectURL: revoke,
    });
    const view = renderReviewFile("evidence.PNG");
    expect(reviewDownload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "evidence.PNG" }));
    await screen.findByRole("img", { name: "evidence.PNG" });
    expect(reviewDownload).toHaveBeenCalledWith("project-a", "resource%2Fa");
    expect(openPreview).not.toHaveBeenCalled();
    view.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:review-image");
  });

  it("does not use project IDs from PDF metadata to download review resources", () => {
    render(
      <PdfNoteContent
        text="fallback"
        custom={{
          ...reviewContent("evidence.docx"),
          projectId: "untrusted-project",
        }}
      />
    );
    expect(
      screen.queryByRole("button", { name: "evidence.docx" })
    ).not.toBeInTheDocument();
    expect(reviewDownload).not.toHaveBeenCalled();
  });

  it("offers an authorized original download after a review file preview is blocked", async () => {
    openPreview.mockResolvedValueOnce(false);
    reviewDownload.mockResolvedValue(new Blob(["original"]));
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        /* Prevent jsdom navigation; inspect the clicked anchor below. */
      });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:original"),
      revokeObjectURL: vi.fn(),
    });
    renderReviewFile("evidence.docx");
    await userEvent.click(
      screen.getByRole("button", { name: "evidence.docx" })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "下载原文件" })
    );
    expect(reviewDownload).toHaveBeenCalledWith("project-a", "resource%2Fa");
    expect(attachmentDownload).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledOnce();
    expect(clicked.mock.instances[0]).toHaveProperty(
      "download",
      "evidence.docx"
    );
  });

  it.each(["unknown.zip", "active.svg", "page.html", "no-extension"])(
    "downloads unsupported %s without opening an incorrect viewer",
    async (fileName) => {
      reviewDownload.mockResolvedValue(new Blob(["original"]));
      const clicked = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {
          /* Prevent jsdom navigation; inspect the clicked anchor below. */
        });
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => "blob:original"),
        revokeObjectURL: vi.fn(),
      });
      renderReviewFile(fileName);
      await userEvent.click(screen.getByRole("button", { name: fileName }));
      expect(reviewDownload).toHaveBeenCalledWith("project-a", "resource%2Fa");
      expect(openPreview).not.toHaveBeenCalled();
      expect(attachmentDownload).not.toHaveBeenCalled();
      expect(clicked.mock.instances[0]).toHaveProperty("download", fileName);
    }
  );

  it("renders every Q in a large document-level discussion", () => {
    const questions = Array.from({ length: 500 }, (_, i) => ({
      id: `external-${i}`,
      status: "待回复",
      messages: [
        {
          id: `m${i}`,
          kind: "问题",
          author: "复核人",
          date: "2026-09-09",
          body: `External question ${i}`,
          images: [],
          references: [],
        },
      ],
    }));
    const view = render(<PdfNoteContent text="fallback" />);
    expect(screen.getByText("fallback")).toBeVisible();
    view.rerender(
      <PdfNoteContent
        text="fallback"
        custom={{ projectWingReview: { version: 1, questions } }}
      />
    );
    expect(screen.getAllByRole("region")).toHaveLength(500);
    expect(
      within(screen.getByRole("region", { name: "Q500" })).getByText(
        "External question 499"
      )
    ).toBeTruthy();
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("renders multiple Q and all conversation rounds under their own headings", () => {
    const questions = [1, 2, 3].map((q) => ({
      id: `q${q}`,
      status: "待回复",
      messages: [1, 2, 3, 4].map((round) => ({
        id: `q${q}-r${round}`,
        kind: round === 1 ? "问题" : "回复",
        author: `用户${round}`,
        date: "2026-09-09",
        body: `**Q${q} 第${round}轮**\n[链接](https://example.com/q${q})`,
        images: [],
        references: [],
      })),
    }));
    const view = render(
      <PdfNoteContent
        text="fallback"
        custom={{
          projectWingReview: { version: 1, questions: questions.slice(0, 1) },
        }}
      />
    );
    expect(screen.getAllByRole("region")).toHaveLength(1);
    view.rerender(
      <PdfNoteContent
        text="fallback"
        custom={{ projectWingReview: { version: 1, questions } }}
      />
    );
    for (const q of [1, 2, 3]) {
      const region = screen.getByRole("region", { name: `Q${q}` });
      expect(within(region).getAllByRole("article")).toHaveLength(4);
      expect(within(region).getByText(`Q${q} 第4轮`).tagName).toBe("STRONG");
      expect(within(region).getAllByRole("link")).toHaveLength(4);
      expect(region.textContent).not.toContain(`Q${q === 3 ? 1 : q + 1} 第`);
    }
    expect(screen.queryByText("问题", { exact: true })).toBeNull();
    expect(screen.queryByText("回复", { exact: true })).toBeNull();
  });

  it("renders paragraphs, emphasis, lists and clickable links", () => {
    const view = render(<PdfNoteContent text="fallback" />);
    expect(screen.getByText("fallback")).toBeVisible();
    view.rerender(
      <PdfNoteContent
        text="fallback"
        custom={content([
          {
            type: "paragraph",
            id: "p",
            content: [
              { type: "text", text: "重点", marks: [{ type: "bold" }] },
            ],
          },
          {
            type: "bulletList",
            id: "list",
            items: [
              {
                id: "li",
                content: [
                  {
                    type: "paragraph",
                    id: "p2",
                    content: [
                      {
                        type: "text",
                        text: "资料链接",
                        marks: [{ type: "link", href: "https://example.com" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ])}
      />
    );
    expect(screen.getByText("重点").tagName).toBe("STRONG");
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://example.com/"
    );
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("uses one icon-name style and theme color for every reference kind, including body links", async () => {
    preview.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    const view = render(
      <PdfNoteProjectContext.Provider value="project-a">
        <PdfNoteContent
          text=""
          custom={content([
            {
              type: "paragraph",
              id: "link",
              content: [
                {
                  type: "text",
                  text: "参考资料",
                  marks: [{ type: "link", href: "https://example.com" }],
                },
              ],
            },
            {
              type: "embed",
              id: "file",
              entityType: "attachment",
              entityId: "file-a",
              labelSnapshot: "凭证.pdf",
            },
            {
              type: "embed",
              id: "image",
              entityType: "image",
              entityId: "image-a",
              labelSnapshot: "截图.png",
            },
            {
              type: "embed",
              id: "paper",
              entityType: "workingPaper",
              entityId: "paper-a",
              labelSnapshot: "A1 核对底稿",
            },
          ])}
        />
      </PdfNoteProjectContext.Provider>
    );
    const references = view.container.querySelectorAll(
      "[data-pdf-note-reference]"
    );
    expect(references).toHaveLength(4);
    for (const reference of references) {
      expect(reference.className).toContain("text-primary");
      expect(reference.className).toContain("text-sm");
      expect(reference.querySelector("svg")).not.toBeNull();
    }
    expect(preview).not.toHaveBeenCalled();
    expect(view.container.querySelector("img")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "凭证.pdf" }));
    expect(preview).toHaveBeenCalledWith("project-a", "file-a");
    expect(reviewDownload).toHaveBeenCalledTimes(0);
  });

  it("retains old text, links and rejects unsafe metadata", () => {
    render(
      <PdfNoteContent
        text={"第一段\n第二段 https://example.com"}
        custom={{ projectWingNote: { version: 99 } }}
      />
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://example.com/"
    );
    // eslint-disable-next-line no-script-url -- Assert rejection of executable PDF links.
    expect(safePdfNoteLink("javascript:alert(1)")).toBeUndefined();
    expect(safePdfNoteLink("file:///C:/secret")).toBeUndefined();
    expect(
      safePdfNoteLink("https://user:password@example.com")
    ).toBeUndefined();
  });

  it("opens files through the authorized preview flow using only trusted project scope", async () => {
    preview.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    render(
      <PdfNoteProjectContext.Provider value="project-a">
        <PdfNoteContent
          text="fallback"
          custom={{
            ...content([
              {
                type: "embed",
                id: "file",
                entityType: "attachment",
                entityId: "file-a",
                labelSnapshot: "凭证.pdf",
              },
            ]),
            projectId: "project-b",
          }}
        />
      </PdfNoteProjectContext.Provider>
    );
    expect(preview).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /凭证/ }));
    expect(preview).toHaveBeenCalledWith("project-a", "file-a");
    expect(openPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-a",
        fileName: "凭证.pdf",
        mimeType: "application/pdf",
        loadBlob: expect.any(Function),
      })
    );
  });

  it("does not fetch referenced images without project context", () => {
    render(
      <PdfNoteContent
        text="fallback"
        custom={content([
          {
            type: "embed",
            id: "image",
            entityType: "image",
            entityId: "img",
            labelSnapshot: "证据.png",
          },
        ])}
      />
    );
    expect(preview).not.toHaveBeenCalled();
    expect(screen.getByText("请从所属项目打开此引用。")).toBeTruthy();
  });

  it("uses the filename over an incorrect rich-text image hint without changing the attachment route", async () => {
    preview.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    render(
      <PdfNoteProjectContext.Provider value="project-a">
        <PdfNoteContent
          text="fallback"
          custom={content([
            {
              type: "embed",
              id: "legacy",
              entityType: "image",
              entityId: "attachment-a",
              labelSnapshot: "evidence.docx",
            },
          ])}
        />
      </PdfNoteProjectContext.Provider>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "evidence.docx" })
    );
    expect(preview).toHaveBeenCalledWith("project-a", "attachment-a");
    expect(reviewDownload).not.toHaveBeenCalled();
    expect(openPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("previews an authorized image, expands it, and releases its object URL", async () => {
    preview.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const create = vi.fn(() => "blob:note-image");
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      }
    );
    const view = render(
      <PdfNoteProjectContext.Provider value="project-a">
        <PdfNoteContent
          text="fallback"
          custom={content([
            {
              type: "embed",
              id: "image",
              entityType: "image",
              entityId: "img",
              labelSnapshot: "证据.png",
            },
          ])}
        />
      </PdfNoteProjectContext.Provider>
    );
    expect(preview).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "证据.png" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await screen.findByRole("img", { name: "证据.png" });
    expect(preview).toHaveBeenCalledWith("project-a", "img");
    view.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:note-image");
  });

  it("keeps a retry action when a requested image is unavailable", async () => {
    preview.mockRejectedValue(new Error("Forbidden"));
    render(
      <PdfNoteProjectContext.Provider value="project-a">
        <PdfNoteContent
          text="fallback"
          custom={content([
            {
              type: "embed",
              id: "image",
              entityType: "image",
              entityId: "img",
              labelSnapshot: "证据.png",
            },
          ])}
        />
      </PdfNoteProjectContext.Provider>
    );
    expect(preview).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "证据.png" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("图片暂不可用")
    );
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});
