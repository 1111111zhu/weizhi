import { act } from "react";
import { createRoot } from "react-dom/client";
// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MobileMessage,
  MobileAttachmentLink,
  MobileImageAttachment,
} from "./mobile-message";
import {
  ReviewNoteRichText,
  tokenizeReviewNoteInline,
} from "./review-note-rich-text";

function render(markup: string) {
  const element = document.createElement("div");
  element.innerHTML = markup;
  return element;
}

describe("mobile review-note conversation", () => {
  it("renders author, time, rich text and a separate attachment link", () => {
    const view = render(
      renderToStaticMarkup(
        <MobileMessage
          author="Alex"
          avatar={<span>A</span>}
          time="09/10 10:30"
          dateTime="2026-09-10T02:30:00Z"
          attachments={
            <MobileAttachmentLink
              fileName="Evidence.pdf"
              icon={<span>PDF</span>}
              href="#document?file=evidence"
            />
          }
        >
          <ReviewNoteRichText value="**Bold** _italic_ [Source](https://example.com)" />
        </MobileMessage>
      )
    );
    expect(view.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-09-10T02:30:00Z"
    );
    expect(
      view.querySelector(".pw-mobile-message-body strong")?.textContent
    ).toBe("Bold");
    expect(view.querySelector("em")?.textContent).toBe("italic");
    expect(
      view.querySelector(".pw-mobile-attachment-link")?.getAttribute("href")
    ).toBe("#document?file=evidence");
    expect(view.querySelector("a a")).toBeNull();
  });

  it("does not invent timestamps for old messages", () => {
    const view = document.createElement("div");
    const root = createRoot(view);
    try {
      act(() =>
        root.render(
          <MobileMessage
            author="Alex"
            avatar={<span>A</span>}
            time="10:30"
            dateTime="2026-09-10T02:30:00Z"
          >
            Dated reply
          </MobileMessage>
        )
      );
      expect(view.querySelector("time")?.getAttribute("datetime")).toBe(
        "2026-09-10T02:30:00Z"
      );
      act(() =>
        root.render(
          <MobileMessage author="Alex" avatar={<span>A</span>}>
            Old reply
          </MobileMessage>
        )
      );
      expect(view.querySelector("time")).toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });

  it("keeps HTML inert and rejects executable-link syntax", () => {
    const view = render(
      renderToStaticMarkup(
        <ReviewNoteRichText value="<script>alert(1)<\/script> [bad](javascript:alert(1))" />
      )
    );
    expect(view.querySelector("script")).toBeNull();
    expect(view.querySelector("a")).toBeNull();
    expect(tokenizeReviewNoteInline("**safe** plain")).toStrictEqual([
      "**safe**",
      " plain",
    ]);
  });

  it("gives the image a named native button, not a PDF annotation", () => {
    const view = render(
      renderToStaticMarkup(
        <MobileImageAttachment
          src="/evidence.svg"
          alt="Evidence chart"
          label="Open chart"
          onOpen={() => {}}
        />
      )
    );
    expect(view.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Open chart"
    );
    expect(view.querySelector("img")?.getAttribute("alt")).toBe(
      "Evidence chart"
    );
  });
});
