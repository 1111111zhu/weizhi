"use client";

import { CircleAlert } from "lucide-react";

import { useCmpI18n } from "../i18n/client";

export type ValidationErrors = Record<string, string | undefined>;

export function FormValidationSummary({ errors }: { errors: object }) {
  const { dictionary } = useCmpI18n();
  const messages = Object.values(errors as ValidationErrors).filter(
    isErrorMessage
  );
  if (messages.length === 0) {
    return null;
  }
  const summary = (
    messages.length === 1
      ? dictionary.workspace.validationSummaryOne
      : dictionary.workspace.validationSummaryMany
  ).replace("{count}", String(messages.length));

  return (
    <section className="cmp-validation-summary" role="alert">
      <CircleAlert aria-hidden="true" />
      <div>
        <strong>{summary}</strong>
        <p>{messages[0]}</p>
      </div>
    </section>
  );
}

export function focusFirstInvalidField(form: HTMLFormElement | null) {
  if (!form) {
    return;
  }

  const focusInvalid = () => {
    const field = form.querySelector<HTMLElement>(
      '[aria-invalid="true"]:not([disabled])'
    );
    if (!field) {
      return;
    }

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    field.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
    field.focus({ preventScroll: true });
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(focusInvalid);
  } else {
    setTimeout(focusInvalid, 0);
  }
}

export function validationErrorId(field: string) {
  return `cmp-${field.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}-error`;
}

export function schemaIssuesToErrors<Key extends string>(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  aliases: Partial<Record<string, Key>> = {}
) {
  const errors: Partial<Record<Key, string>> = {};
  for (const issue of issues) {
    const source = issue.path.map(String).join(".");
    const root = String(issue.path[0] ?? "");
    const key = aliases[source] ?? aliases[root] ?? (source as Key);
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

function isErrorMessage(value: string | undefined): value is string {
  return Boolean(value);
}
