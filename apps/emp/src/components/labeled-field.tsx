import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";

export function LabeledField({
  label,
  children,
  error,
  id,
}: {
  label: ReactNode;
  children?: ReactNode;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <Field>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      {withFieldControlProps(children, controlId, errorId)}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

function withFieldControlProps(
  children: ReactNode,
  id: string,
  errorId?: string
) {
  if (!isValidElement(children)) {
    return children;
  }

  const child = children as ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;

  return cloneElement(child, {
    id: child.props.id ?? id,
    "aria-describedby": errorId ?? child.props["aria-describedby"],
    "aria-invalid": Boolean(errorId) || child.props["aria-invalid"],
  });
}
