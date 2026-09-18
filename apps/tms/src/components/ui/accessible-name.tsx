"use client";

import { cloneElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

type AccessibleNameProps = {
  children: ReactElement<{ "aria-labelledby"?: string }>;
  label: ReactNode;
};

export function AccessibleName({ children, label }: AccessibleNameProps) {
  const labelId = useId();
  const labelledBy = [children.props["aria-labelledby"], labelId]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <span id={labelId} hidden>
        {label}
      </span>
      {cloneElement(children, { "aria-labelledby": labelledBy })}
    </>
  );
}
