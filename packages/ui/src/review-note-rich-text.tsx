import { Fragment } from "react";
import type { ReactNode } from "react";

import { cn } from "./utils";

export function ReviewNoteRichText({
  value,
  className,
  renderLink,
}: {
  value: string;
  className?: string;
  renderLink?: (href: string, label: ReactNode) => ReactNode;
}) {
  const lines = value.replaceAll(/\r\n?/g, "\n").split("\n");
  return (
    <div className={cn("grid gap-1.5 break-words", className)}>
      {lines.map((line, index) => (
        <Fragment key={`${index}-${line.slice(0, 16)}`}>
          {renderReviewNoteLine(line, index, renderLink)}
        </Fragment>
      ))}
    </div>
  );
}

function renderReviewNoteLine(
  line: string,
  index: number,
  renderLink?: (href: string, label: ReactNode) => ReactNode
) {
  if (!line) {
    return <span aria-hidden="true" className="h-2" />;
  }
  if (line.startsWith("### ")) {
    return (
      <h4 className="text-sm font-semibold">
        {renderInlineFormatting(line.slice(4), index, renderLink)}
      </h4>
    );
  }
  if (line.startsWith("## ")) {
    return (
      <h3 className="text-base font-semibold">
        {renderInlineFormatting(line.slice(3), index, renderLink)}
      </h3>
    );
  }
  if (line.startsWith("> ")) {
    return (
      <blockquote className="border-l-2 border-current/30 pl-3 opacity-90">
        {renderInlineFormatting(line.slice(2), index, renderLink)}
      </blockquote>
    );
  }
  if (line.startsWith("- ")) {
    return (
      <div className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-1">
        <span aria-hidden="true">•</span>
        <span>{renderInlineFormatting(line.slice(2), index, renderLink)}</span>
      </div>
    );
  }
  const orderedMatch = line.match(/^(\d+)\.\s(.*)$/);
  if (orderedMatch) {
    return (
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1">
        <span>{orderedMatch[1]}.</span>
        <span>
          {renderInlineFormatting(orderedMatch[2], index, renderLink)}
        </span>
      </div>
    );
  }
  return <p>{renderInlineFormatting(line, index, renderLink)}</p>;
}

const INLINE_TOKEN_PATTERN =
  /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|\[u\][\s\S]*?\[\/u\]|`[^`\n]+`|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

function renderInlineFormatting(
  value: string,
  lineIndex: number,
  renderLink?: (href: string, label: ReactNode) => ReactNode
) {
  return value
    .split(INLINE_TOKEN_PATTERN)
    .filter(Boolean)
    .map((token, tokenIndex) => {
      const key = `${lineIndex}-${tokenIndex}`;
      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={key}>{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith("~~") && token.endsWith("~~")) {
        return <s key={key}>{token.slice(2, -2)}</s>;
      }
      if (token.startsWith("[u]") && token.endsWith("[/u]")) {
        return <u key={key}>{token.slice(3, -4)}</u>;
      }
      if (token.startsWith("`") && token.endsWith("`")) {
        return (
          <code
            key={key}
            className="bg-foreground/10 rounded px-1 py-0.5 font-mono text-[0.9em]"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith("_") && token.endsWith("_")) {
        return <em key={key}>{token.slice(1, -1)}</em>;
      }
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (link) {
        if (renderLink) {
          return <Fragment key={key}>{renderLink(link[2], link[1])}</Fragment>;
        }
        return (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="pw-text-link"
          >
            {link[1]}
          </a>
        );
      }
      return <Fragment key={key}>{token}</Fragment>;
    });
}

/** Shared grammar used by the reader and the EMP rich-text composer. */
export function tokenizeReviewNoteInline(value: string) {
  return value.split(INLINE_TOKEN_PATTERN).filter(Boolean);
}
