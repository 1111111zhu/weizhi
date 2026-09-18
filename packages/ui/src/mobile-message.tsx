"use client";

import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";

export function MobileMessage({
  author,
  avatar,
  time,
  dateTime,
  children,
  attachments,
  variant = "reply",
}: {
  author: string;
  avatar: ReactNode;
  time?: string;
  dateTime?: string;
  children: ReactNode;
  attachments?: ReactNode;
  variant?: "initial" | "reply";
}) {
  return (
    <article
      className="pw-mobile-message"
      data-variant={variant}
      aria-label={author}
    >
      <span className="pw-mobile-message-avatar" aria-hidden>
        {avatar}
      </span>
      <header className="pw-mobile-message-header">
        <strong>{author}</strong>
        {time ? <time dateTime={dateTime}>{time}</time> : null}
      </header>
      <div className="pw-mobile-message-body">
        {children}
        {attachments ? (
          <div className="pw-mobile-message-attachments">{attachments}</div>
        ) : null}
      </div>
    </article>
  );
}

export function MobileAttachmentLink({
  fileName,
  icon,
  href,
  onNavigate,
}: {
  fileName: string;
  icon: ReactNode;
  href: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      className="pw-mobile-attachment-link"
      href={href}
      onClick={onNavigate}
      title={fileName}
    >
      <span aria-hidden>{icon}</span>
      <span>{fileName}</span>
    </a>
  );
}

export function MobileImageAttachment({
  src,
  alt,
  label,
  onOpen,
  expanded = false,
}: {
  src: string;
  alt: string;
  label: string;
  onOpen: () => void;
  expanded?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <button
      type="button"
      className="pw-mobile-image-attachment"
      data-expanded={expanded || undefined}
      aria-label={label}
      onClick={onOpen}
    >
      {failedSource === src ? (
        <span>{alt}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- Shared media primitive is also used outside Next.
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSource(src)}
        />
      )}
    </button>
  );
}
