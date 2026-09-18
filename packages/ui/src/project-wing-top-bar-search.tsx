import { Input as InputPrimitive } from "@base-ui/react/input";
import type { ComponentProps, ReactNode } from "react";

export function ProjectWingTopBarSearch({
  ariaLabel,
  icon,
  className,
  ...props
}: {
  ariaLabel: string;
  icon?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "aria-label" | "className" | "type">) {
  return (
    <div
      className={`project-wing-top-bar-search${className ? ` ${className}` : ""}`}
      data-slot="input-group"
      data-top-bar-search=""
      role="group"
    >
      <span aria-hidden="true" className="project-wing-top-bar-search-label">
        {ariaLabel}
      </span>
      {icon ? (
        <span aria-hidden="true" className="project-wing-top-bar-search-icon">
          {icon}
        </span>
      ) : null}
      <InputPrimitive
        {...props}
        placeholder={props.placeholder ?? ariaLabel}
        aria-label={ariaLabel}
        data-slot="input-group-control"
        type="search"
      />
    </div>
  );
}
