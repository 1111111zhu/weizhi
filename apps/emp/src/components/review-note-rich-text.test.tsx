import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ReviewNoteRichText,
  ReviewNoteRichTextComposer,
  reviewNoteDocumentToMarkdown,
  reviewNoteMarkdownToDocument,
} from "./review-note-rich-text";
import type { ReviewNoteEditorCopy } from "./review-note-rich-text";

const copy: ReviewNoteEditorCopy = {
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
};

function placeCaret(element: Element, offset: number) {
  const root = element.closest<HTMLElement>("[contenteditable='true']");
  root?.focus();
  const range = document.createRange();
  const target = element.firstChild ?? element;
  range.setStart(target, offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent(document, new Event("selectionchange", { bubbles: true }));
}

function selectTextRange(element: HTMLElement, from: number, to: number) {
  element.focus();
  const text = element.querySelector("p")?.firstChild;
  if (!text) {
    throw new Error("Missing editor text");
  }
  const range = document.createRange();
  range.setStart(text, from);
  range.setEnd(text, to);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent(document, new Event("selectionchange", { bubbles: true }));
}

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
  });

  describe(ReviewNoteRichTextComposer, () => {
    it("keeps compact common tools visible and moves advanced formats into a sheet", async () => {
      const onFiles = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value="Mobile text"
          onChange={vi.fn()}
          ariaLabel="Mobile note"
          placeholder="Write"
          copy={copy}
          toolbarDensity="compact"
          overlayPlacement="bottom"
          allowImages
          onFiles={onFiles}
        />
      );
      const toolbar = await screen.findByRole("toolbar");
      for (const name of [
        "Bold",
        "Italic",
        "Underline",
        "Mention",
        "More formatting",
      ]) {
        expect(within(toolbar).getByRole("button", { name })).toBeVisible();
      }
      for (const name of [
        "Paragraph",
        "Strikethrough",
        "Inline code",
        "Bullet list",
        "Numbered list",
        "Quote",
        "Link",
      ]) {
        expect(within(toolbar).queryByRole("button", { name })).toBeNull();
      }
      expect(
        within(toolbar).getByRole("button", { name: "Attach file" })
      ).toBeVisible();
      const input = screen.getByLabelText("Attach file", {
        selector: "input",
      });
      await userEvent.click(
        within(toolbar).getByRole("button", { name: "More formatting" })
      );
      const sheet = await screen.findByRole("dialog");
      expect(sheet).toHaveClass("pw-mobile-sheet");
      for (const name of [
        "Paragraph",
        "Heading 2",
        "Heading 3",
        "Strikethrough",
        "Inline code",
        "Bullet list",
        "Numbered list",
        "Quote",
        "Link",
      ]) {
        expect(within(sheet).getByRole("button", { name })).toBeVisible();
      }
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.getByLabelText("Attach file", { selector: "input" })).toBe(
        input
      );
      const image = new File(["image"], "evidence.png", { type: "image/png" });
      fireEvent.change(input, { target: { files: [image] } });
      expect(onFiles).toHaveBeenCalledExactlyOnceWith([image]);
    });

    it("applies compact advanced formatting only to the saved selection", async () => {
      const onChange = vi.fn();
      function Controlled() {
        const [value, setValue] = useState("Alpha Beta Gamma");
        return (
          <ReviewNoteRichTextComposer
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
            ariaLabel="Mobile note"
            placeholder="Write"
            copy={copy}
            toolbarDensity="compact"
            overlayPlacement="bottom"
          />
        );
      }
      render(<Controlled />);
      const editor = await screen.findByRole("textbox", {
        name: "Mobile note",
      });
      selectTextRange(editor, 6, 10);
      await userEvent.click(
        screen.getByRole("button", { name: "More formatting" })
      );
      const sheet = await screen.findByRole("dialog");
      await userEvent.click(
        within(sheet).getByRole("button", { name: "Strikethrough" })
      );
      await waitFor(() =>
        expect(editor.querySelector("s")).toHaveTextContent("Beta")
      );
      expect(editor.textContent).toBe("Alpha Beta Gamma");
      expect(onChange).toHaveBeenLastCalledWith("Alpha ~~Beta~~ Gamma");
      await waitFor(() => expect(editor).toHaveFocus());
      onChange.mockClear();
      await userEvent.click(
        screen.getByRole("button", { name: "More formatting" })
      );
      await screen.findByRole("dialog");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onChange).not.toHaveBeenCalled();
    });

    it("retains a compact format at the caret for subsequently typed text", async () => {
      function Controlled() {
        const [value, setValue] = useState("Alpha ");
        return (
          <ReviewNoteRichTextComposer
            value={value}
            onChange={setValue}
            ariaLabel="Mobile note"
            placeholder="Write"
            copy={copy}
            toolbarDensity="compact"
            overlayPlacement="bottom"
          />
        );
      }
      render(<Controlled />);
      const editor = await screen.findByRole("textbox", {
        name: "Mobile note",
      });
      const paragraph = editor.querySelector("p");
      if (!paragraph) {
        throw new Error("Missing paragraph");
      }
      placeCaret(paragraph, paragraph.textContent?.length ?? 0);
      await userEvent.click(
        screen.getByRole("button", { name: "More formatting" })
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Inline code",
        })
      );
      await waitFor(() => expect(editor).toHaveFocus());
      await userEvent.keyboard("Beta");
      await waitFor(() =>
        expect(editor.querySelector("code")).toHaveTextContent("Beta")
      );
      expect(editor.textContent).toBe("Alpha Beta");
    });

    it("preserves selected text and link input focus when compact more opens the link sheet", async () => {
      render(
        <ReviewNoteRichTextComposer
          value="Alpha Beta Gamma"
          onChange={vi.fn()}
          ariaLabel="Mobile note"
          placeholder="Write"
          copy={copy}
          toolbarDensity="compact"
          overlayPlacement="bottom"
        />
      );
      const editor = await screen.findByRole("textbox", {
        name: "Mobile note",
      });
      selectTextRange(editor, 6, 10);
      await userEvent.click(
        screen.getByRole("button", { name: "More formatting" })
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Link",
        })
      );
      const linkSheet = await screen.findByRole("dialog", {
        name: "Insert link",
      });
      expect(
        within(linkSheet).getByRole("textbox", { name: "Display text" })
      ).toHaveValue("Beta");
      const address = within(linkSheet).getByRole("textbox", {
        name: "Link address",
      });
      await userEvent.type(address, "https://example.com/evidence");
      expect(address).toHaveFocus();
      await userEvent.click(
        within(linkSheet).getByRole("button", { name: "Insert link" })
      );
      await waitFor(() =>
        expect(editor.querySelector("a")).toHaveTextContent("Beta")
      );
      expect(editor.querySelector("a")).toHaveAttribute(
        "href",
        "https://example.com/evidence"
      );
      expect(editor.textContent).toBe("Alpha Beta Gamma");
    });

    it("disables compact entry points without changing capability restrictions", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value="Locked"
          onChange={onChange}
          ariaLabel="Mobile note"
          placeholder="Write"
          copy={copy}
          toolbarDensity="compact"
          overlayPlacement="bottom"
          disabled
          allowImages
          allowedMarks={["bold", "strike"]}
          allowedBlocks={["paragraph"]}
        />
      );
      const toolbar = await screen.findByRole("toolbar");
      for (const name of ["Bold", "Mention", "More formatting"]) {
        expect(within(toolbar).getByRole("button", { name })).toBeDisabled();
      }
      expect(
        screen.getByLabelText("Attach file", { selector: "input" })
      ).toBeDisabled();
      expect(
        within(toolbar).queryByRole("button", { name: "Italic" })
      ).toBeNull();
      expect(
        within(toolbar).queryByRole("button", { name: "Underline" })
      ).toBeNull();
      await userEvent.click(
        within(toolbar).getByRole("button", { name: "More formatting" })
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(0);
    });

    it.each(["button", "typing"])(
      "inserts a compact mention from %s without duplicating the trigger",
      async (source) => {
        const onChange = vi.fn();
        render(
          <ReviewNoteRichTextComposer
            value=""
            onChange={onChange}
            ariaLabel="Mobile note"
            placeholder="Write"
            copy={copy}
            toolbarDensity="compact"
            overlayPlacement="bottom"
            mentionOptions={[
              { id: "eden", label: "Eden Chan", description: "REVIEWER" },
            ]}
          />
        );
        const editor = await screen.findByRole("textbox", {
          name: "Mobile note",
        });
        if (source === "typing") {
          await userEvent.click(editor);
          await userEvent.keyboard("@");
        } else {
          await userEvent.click(
            screen.getByRole("button", { name: "Mention" })
          );
        }
        const sheet = await screen.findByRole("dialog", { name: "Mention" });
        await userEvent.click(
          within(sheet).getByRole("button", { name: /Eden Chan/ })
        );
        await waitFor(() =>
          expect(onChange).toHaveBeenLastCalledWith("@Eden Chan")
        );
        await waitFor(() => expect(editor).toHaveFocus());
        expect(editor.textContent).not.toContain("@@");
      }
    );

    it("uses bottom sheets for mobile block formatting and link entry", async () => {
      render(
        <ReviewNoteRichTextComposer
          value="Mobile text"
          onChange={vi.fn()}
          ariaLabel="Mobile note"
          placeholder="Write"
          copy={copy}
          presentation="plain"
          overlayPlacement="bottom"
        />
      );
      const editor = await screen.findByRole("textbox", {
        name: "Mobile note",
      });
      await userEvent.click(screen.getByRole("button", { name: "Paragraph" }));
      const formatSheet = await screen.findByRole("dialog", {
        name: "Formatting toolbar",
      });
      expect(formatSheet).toHaveClass("pw-mobile-sheet");
      await userEvent.click(
        within(formatSheet).getByRole("button", { name: "Heading 2" })
      );
      await waitFor(() =>
        expect(editor.querySelector("h2")).toHaveTextContent("Mobile text")
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Formatting toolbar" })
        ).not.toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole("button", { name: "Link" }));
      const linkSheet = await screen.findByRole("dialog", {
        name: "Insert link",
      });
      expect(linkSheet).toHaveClass("pw-mobile-sheet");
    });

    it("keeps contextual editing active through its link dialog without changing content on focus", async () => {
      const onChange = vi.fn();
      const { container } = render(
        <ReviewNoteRichTextComposer
          presentation="contextual"
          value="Keep this conclusion"
          onChange={onChange}
          ariaLabel="Conclusion"
          placeholder="Write"
          copy={copy}
        />
      );
      const editor = await screen.findByRole("textbox", { name: "Conclusion" });
      const composer = container.querySelector(
        '[data-slot="review-note-rich-text-composer"]'
      );
      expect(composer).toHaveAttribute("data-editing", "false");
      fireEvent.focus(editor);
      expect(composer).toHaveAttribute("data-editing", "true");
      fireEvent.blur(editor, { relatedTarget: null });
      expect(composer).toHaveAttribute("data-editing", "false");
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.focus(editor);
      await userEvent.click(screen.getByRole("button", { name: "Link" }));
      await screen.findByRole("dialog");
      expect(composer).toHaveAttribute("data-editing", "true");
      expect(editor).toHaveTextContent("Keep this conclusion");
    });

    it("does not emit stale content when sending disables and clears the editor", async () => {
      const onChange = vi.fn();
      const props = {
        value: "Sent content",
        onChange,
        ariaLabel: "Message",
        placeholder: "Type a message",
        copy,
      };
      const { rerender } = render(<ReviewNoteRichTextComposer {...props} />);
      const editor = await screen.findByRole("textbox", { name: "Message" });
      onChange.mockClear();
      rerender(<ReviewNoteRichTextComposer {...props} value="" disabled />);
      await waitFor(() => expect(editor.textContent).toBe(""));
      rerender(<ReviewNoteRichTextComposer {...props} value="" />);
      expect(screen.getByRole("textbox", { name: "Message" })).toBe(editor);
      expect(editor.textContent).toBe("");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("inserts a named link into an empty editor and preserves it in saved markdown", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          onChange={onChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
        />
      );
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Link" }));
      const dialog = await screen.findByRole("dialog", { name: "Insert link" });
      await user.type(
        within(dialog).getByRole("textbox", { name: "Display text" }),
        "Audit guidance"
      );
      await user.type(
        within(dialog).getByRole("textbox", { name: "Link address" }),
        "example.com/guidance"
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Insert link" })
      );
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          "[Audit guidance](https://example.com/guidance)"
        )
      );
      expect(
        screen
          .getByRole("textbox", { name: "Message" })
          .querySelector("a")
          ?.getAttribute("href")
      ).toBe("https://example.com/guidance");
      expect(
        screen.getByRole("textbox", { name: "Message" }).querySelector("a")
      ).toHaveClass("pw-text-link");
    });

    it("edits selected link text, rejects unsafe addresses, and leaves content unchanged on cancel", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value="Original"
          onChange={onChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
        />
      );
      const user = userEvent.setup();
      await user.click(await screen.findByRole("textbox", { name: "Message" }));
      await user.keyboard("{Control>}a{/Control}");
      await user.click(screen.getByRole("button", { name: "Link" }));
      const dialog = await screen.findByRole("dialog", { name: "Insert link" });
      expect(
        within(dialog).getByRole("textbox", { name: "Display text" })
      ).toHaveValue("Original");
      await user.type(
        within(dialog).getByRole("textbox", { name: "Link address" }),
        // eslint-disable-next-line no-script-url -- Verify unsafe link schemes are rejected without executing them.
        "javascript:alert(1)"
      );
      expect(
        within(dialog).getByRole("button", { name: "Insert link" })
      ).toBeDisabled();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(
        screen.getByRole("textbox", { name: "Message" })
      ).toHaveTextContent("Original");
      await user.click(screen.getByRole("button", { name: "Link" }));
      const reopened = await screen.findByRole("dialog", {
        name: "Insert link",
      });
      await user.clear(
        within(reopened).getByRole("textbox", { name: "Display text" })
      );
      await user.type(
        within(reopened).getByRole("textbox", { name: "Display text" }),
        "Source"
      );
      await user.type(
        within(reopened).getByRole("textbox", { name: "Link address" }),
        "https://example.com/source"
      );
      await user.click(
        within(reopened).getByRole("button", { name: "Insert link" })
      );
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          "[Source](https://example.com/source)"
        )
      );
    });

    it("formats selected text without exposing markdown tokens", async () => {
      const onChange = vi.fn();
      function ControlledComposer() {
        const [value, setValue] = useState("Important");
        return (
          <ReviewNoteRichTextComposer
            value={value}
            onChange={(nextValue) => {
              onChange(nextValue);
              setValue(nextValue);
            }}
            ariaLabel="Message"
            placeholder="Type a message"
            copy={copy}
          />
        );
      }
      render(<ControlledComposer />);

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const user = userEvent.setup();
      await user.click(editor);
      await user.keyboard("{Control>}a{/Control}");
      await user.click(screen.getByRole("button", { name: "Bold" }));

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith("**Important**")
      );
      expect(editor.querySelector("strong")?.textContent).toBe("Important");
      expect(editor.textContent).toBe("Important");
      expect(editor.textContent).not.toContain("**");
    });

    it("gives active mark controls a high-contrast selected state", async () => {
      render(
        <ReviewNoteRichTextComposer
          value="Important"
          onChange={vi.fn()}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const user = userEvent.setup();
      await user.click(editor);
      await user.keyboard("{Control>}a{/Control}");
      const bold = screen.getByRole("button", { name: "Bold" });
      const italic = screen.getByRole("button", { name: "Italic" });
      await user.click(bold);
      await user.click(italic);

      expect(bold).toHaveAttribute("aria-pressed", "true");
      expect(italic).toHaveAttribute("aria-pressed", "true");
      expect(bold).toHaveClass(
        "bg-primary",
        "text-primary-foreground",
        "shadow-sm"
      );
      expect(italic).toHaveClass(
        "bg-primary",
        "text-primary-foreground",
        "shadow-sm"
      );
    });

    it("removes an empty blockquote immediately when SmartForm deletion is enabled", async () => {
      const onDocumentChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          documentValue={{
            type: "doc",
            content: [
              {
                type: "blockquote",
                content: [{ type: "paragraph" }],
              },
            ],
          }}
          onChange={vi.fn()}
          onDocumentChange={onDocumentChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          removeEmptyStructuredBlockOnBackspace
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const emptyParagraph = editor.querySelector("blockquote p");
      expect(emptyParagraph).not.toBeNull();
      placeCaret(emptyParagraph as Element, 0);
      fireEvent.keyDown(editor, { key: "Backspace", code: "Backspace" });

      await waitFor(() =>
        expect(editor.querySelector("blockquote")).toBeNull()
      );
      expect(editor.querySelector("p")).not.toBeNull();
      expect(onDocumentChange.mock.lastCall?.[0]).toMatchObject({
        content: [{ type: "paragraph" }],
      });
    });

    it("replaces the final empty ordered-list item with a writable paragraph", async () => {
      const onDocumentChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          documentValue={{
            type: "doc",
            content: [
              {
                type: "orderedList",
                content: [
                  {
                    type: "listItem",
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          }}
          onChange={vi.fn()}
          onDocumentChange={onDocumentChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          removeEmptyStructuredBlockOnBackspace
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const emptyItem = editor.querySelector("li p");
      expect(emptyItem).not.toBeNull();
      placeCaret(emptyItem as Element, 0);
      fireEvent.keyDown(editor, { key: "Backspace", code: "Backspace" });

      await waitFor(() => expect(editor.querySelector("ol")).toBeNull());
      expect(editor.querySelector("p")).not.toBeNull();
      expect(onDocumentChange.mock.lastCall?.[0]).toMatchObject({
        content: [{ type: "paragraph" }],
      });
    });

    it("removes an empty ordered-list item without removing its siblings", async () => {
      const onDocumentChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          documentValue={{
            type: "doc",
            content: [
              {
                type: "orderedList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Keep" }],
                      },
                    ],
                  },
                  {
                    type: "listItem",
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          }}
          onChange={vi.fn()}
          onDocumentChange={onDocumentChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          removeEmptyStructuredBlockOnBackspace
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const emptyItem = editor.querySelector("li:last-child p");
      expect(emptyItem).not.toBeNull();
      placeCaret(emptyItem as Element, 0);
      fireEvent.keyDown(editor, { key: "Backspace", code: "Backspace" });

      await waitFor(() =>
        expect(editor.querySelectorAll("li")).toHaveLength(1)
      );
      expect(editor).toHaveTextContent("Keep");
      expect(onDocumentChange.mock.lastCall?.[0]).toMatchObject({
        content: [
          {
            type: "orderedList",
            content: [{ type: "listItem" }],
          },
        ],
      });
    });

    it("keeps non-empty structured content on the editor's normal deletion path", async () => {
      render(
        <ReviewNoteRichTextComposer
          value="> Evidence"
          onChange={vi.fn()}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          removeEmptyStructuredBlockOnBackspace
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const paragraph = editor.querySelector("blockquote p");
      expect(paragraph?.textContent).toBe("Evidence");
      placeCaret(paragraph as Element, "Evidence".length);
      fireEvent.keyDown(editor, { key: "Backspace", code: "Backspace" });

      expect(editor.querySelector("blockquote")).not.toBeNull();
      expect(editor).toHaveTextContent("Evidenc");
    });

    it("keeps attachment upload in the formatting toolbar", async () => {
      const onFiles = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          onChange={vi.fn()}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          allowImages
          accept="image/*"
          onFiles={onFiles}
        />
      );

      const toolbar = await screen.findByRole("toolbar", {
        name: "Formatting toolbar",
      });
      const input = within(toolbar).getByLabelText("Attach file", {
        selector: "input",
      });
      const image = new File(["image"], "evidence.png", { type: "image/png" });
      fireEvent.change(input, { target: { files: [image] } });

      expect(onFiles).toHaveBeenCalledWith([image]);
    });

    it("uses Enter for a new line instead of treating it as a send shortcut", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value="First line"
          onChange={onChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const user = userEvent.setup();
      await user.click(editor);
      await user.keyboard("{Enter}");

      await waitFor(() => expect(editor.querySelectorAll("p")).toHaveLength(2));
      expect(onChange).toHaveBeenCalledWith(
        expect.stringContaining("First line")
      );
      expect(onChange.mock.lastCall?.[0]).toContain("First line");
      expect(editor.querySelectorAll("p")).toHaveLength(2);
      expect(editor.textContent).toBe("First line");
    });

    it("opens the project-member list and inserts the selected mention", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          onChange={onChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          mentionOptions={[
            { id: "eden", label: "Eden Chan", description: "MANAGER" },
            { id: "amy", label: "Amy Chan", description: "TEAM_MEMBER" },
          ]}
        />
      );

      fireEvent.click(await screen.findByRole("button", { name: "Mention" }));
      const member = await screen.findByRole("menuitem", {
        name: /Eden Chan/,
      });
      expect(screen.getByRole("menuitem", { name: /Amy Chan/ })).toBeTruthy();
      expect(
        within(member).getByRole("img", { name: "Eden Chan" })
      ).toHaveTextContent("EC");
      fireEvent.click(member);

      await waitFor(() => expect(onChange).toHaveBeenCalledWith("@Eden Chan"));
      await waitFor(() =>
        expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus()
      );
    });

    it("opens the same member list when @ is typed and replaces the trigger", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value=""
          onChange={onChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          mentionOptions={[
            { id: "eden", label: "Eden Chan", description: "REVIEWER" },
          ]}
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const user = userEvent.setup();
      await user.click(editor);
      await user.keyboard("@");
      fireEvent.click(
        await screen.findByRole("menuitem", { name: /Eden Chan/ })
      );

      await waitFor(() =>
        expect(onChange.mock.lastCall?.[0]).toBe("@Eden Chan")
      );
      expect(onChange).not.toHaveBeenCalledWith("@@Eden Chan");
    });

    it("filters mention options and restores the editor selection after searching", async () => {
      const onChange = vi.fn();
      render(
        <ReviewNoteRichTextComposer
          value="Alpha "
          onChange={onChange}
          ariaLabel="Message"
          placeholder="Type a message"
          copy={copy}
          mentionOptions={[
            { id: "eden", label: "Eden Chan", description: "REVIEWER" },
            { id: "amy", label: "Amy Chan", description: "TEAM_MEMBER" },
          ]}
        />
      );

      const editor = await screen.findByRole("textbox", { name: "Message" });
      const paragraph = editor.querySelector("p");
      if (!paragraph) {
        throw new Error("Missing editor paragraph");
      }
      placeCaret(paragraph, paragraph.textContent?.length ?? 0);
      fireEvent.click(screen.getByRole("button", { name: "Mention" }));

      const search = await screen.findByRole("searchbox", {
        name: "Search members",
      });
      await userEvent.type(search, "Amy");
      expect(screen.queryByRole("menuitem", { name: /Eden Chan/ })).toBeNull();
      const amy = screen.getByRole("menuitem", { name: /Amy Chan/ });
      fireEvent.click(amy);

      await waitFor(() =>
        expect(onChange.mock.lastCall?.[0]).toBe("Alpha @Amy Chan")
      );
      expect(editor).toHaveFocus();
    });
  });

  describe("review note document compatibility", () => {
    it("round-trips supported legacy markdown through the editor document", () => {
      const markdown = [
        "## Finding",
        "**Bold** _italic_ [u]underlined[/u] ~~removed~~ `code`",
        "- First item",
        "- Second item",
        "> Evidence",
        "[Source](https://example.com)",
      ].join("\n");

      expect(
        reviewNoteDocumentToMarkdown(reviewNoteMarkdownToDocument(markdown))
      ).toBe(markdown);
    });
  });

  describe(ReviewNoteRichText, () => {
    it("renders formatted and legacy plain-text content safely", async () => {
      render(
        <ReviewNoteRichText
          value={[
            "## Finding",
            "**Bold** _italic_ [u]underlined[/u] ~~removed~~ `code`",
            "- First item",
            "> Evidence",
            "[Source](https://example.com)",
            "Legacy plain text",
          ].join("\n")}
        />
      );

      expect(
        screen.getByRole("heading", { name: "Finding", level: 3 })
      ).toBeTruthy();
      expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
        "href",
        "https://example.com"
      );
      expect(screen.getByText("Legacy plain text")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Source" })).toHaveClass(
        "pw-text-link"
      );
      const source = screen.getByRole("link", { name: "Source" });
      const activate = vi.fn((event: Event) => event.preventDefault());
      source.addEventListener("click", activate);
      await userEvent.click(source);
      expect(activate).toHaveBeenCalledOnce();
    });
  });
});
