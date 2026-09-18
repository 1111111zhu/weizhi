"use client";

import { Button } from "@project-wing/ui";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function CmpFormRouteShell({
  eyebrow,
  title,
  description,
  backLabel = "Back",
  onBack,
  children,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backLabel?: string;
  onBack: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section className="cmp-form-route-shell is-compact" aria-label={title}>
        {children}
      </section>
    );
  }

  return (
    <section
      className="cmp-form-route-shell"
      aria-labelledby="cmp-form-route-title"
    >
      <header className="cmp-form-route-heading">
        <Button
          type="button"
          variant="quiet"
          className="cmp-form-route-back"
          onClick={onBack}
          aria-label={backLabel}
        >
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Button>
        <div>
          {eyebrow ? <p className="cmp-eyebrow">{eyebrow}</p> : null}
          <h1 id="cmp-form-route-title">{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function CmpFormRouteUnavailable({
  title,
  message,
  backLabel = "Back to list",
  onBack,
}: {
  title: string;
  message: string;
  backLabel?: string;
  onBack: () => void;
}) {
  return (
    <section
      className="cmp-form-route-empty"
      aria-labelledby="cmp-form-route-empty-title"
    >
      <h1 id="cmp-form-route-empty-title">{title}</h1>
      <p>{message}</p>
      <Button fullWidth size="lg" type="button" onClick={onBack}>
        {backLabel}
      </Button>
    </section>
  );
}
