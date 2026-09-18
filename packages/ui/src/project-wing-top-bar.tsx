import { ArrowLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { MotionButton } from "./motion-button";
import { ProjectWingDevLogo } from "./project-wing-dev-logo";
import type { ProjectWingDevLogoVariant } from "./project-wing-dev-logo";
import { ProjectWingTopBarLayoutCoordinator } from "./project-wing-top-bar-layout-coordinator";

const DEFAULT_TOP_BAR_BRAND_LINES = [
  "Engagement",
  "Management",
  "Platform",
] as const;

export function ProjectWingTopBar({
  leading,
  center,
  centerOnMobile = false,
  centerPriority = false,
  independentHover = false,
  actions,
  overlays,
  className,
  ...props
}: {
  leading?: ReactNode;
  center?: ReactNode;
  centerOnMobile?: boolean;
  centerPriority?: boolean;
  independentHover?: boolean;
  actions?: ReactNode;
  overlays?: ReactNode;
  className?: string;
} & ComponentProps<"header">) {
  return (
    <ProjectWingTopBarLayoutCoordinator
      actions={actions}
      center={center}
      centerOnMobile={centerOnMobile}
      centerPriority={centerPriority}
      independentHover={independentHover}
      className={className}
      leading={leading}
      overlays={overlays}
      {...props}
    />
  );
}

export function ProjectWingTopBarBrand({
  lines = DEFAULT_TOP_BAR_BRAND_LINES,
  label,
  hideText = false,
  markVariant,
  className,
}: {
  lines?: readonly [string, string, string];
  label?: string;
  hideText?: boolean;
  markVariant?: ProjectWingDevLogoVariant;
  className?: string;
}) {
  return (
    <div
      className={`project-wing-top-bar-brand${className ? ` ${className}` : ""}`}
    >
      <ProjectWingDevLogo
        className="project-wing-top-bar-brand-mark"
        variant={markVariant}
        alt={label ?? lines.join(" ")}
      />
      {hideText ? null : label ? (
        <span className="project-wing-top-bar-brand-label" aria-hidden="true">
          <span className="project-wing-top-bar-brand-label-initial">
            {label.charAt(0)}
          </span>
          {label.slice(1)}
        </span>
      ) : (
        <span className="project-wing-top-bar-brand-copy" aria-hidden="true">
          {lines.map((line) => (
            <span className="project-wing-top-bar-brand-line" key={line}>
              <span className="project-wing-top-bar-brand-initial">
                {line.charAt(0).toUpperCase()}
              </span>
              {line.slice(1)}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export function ProjectWingTopBarReturnAction({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <MotionButton
      aria-label={label}
      className={`project-wing-top-bar-back-link project-wing-top-bar-return-action${className ? ` ${className}` : ""}`}
      data-slot="project-wing-top-bar-return-action"
      size="icon"
      variant="ghost"
      onClick={onClick}
    >
      <ArrowLeft aria-hidden="true" />
    </MotionButton>
  );
}

export function ProjectWingTopBarTitle({
  eyebrow,
  title,
  titleContent,
  description,
  className,
}: {
  eyebrow?: ReactNode;
  title: string;
  titleContent?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`project-wing-top-bar-title${className ? ` ${className}` : ""}`}
      data-slot="project-wing-top-bar-title"
    >
      {eyebrow ? (
        <div
          className="project-wing-top-bar-title-eyebrow"
          data-slot="project-wing-top-bar-title-eyebrow"
        >
          {eyebrow}
        </div>
      ) : null}
      {titleContent ? (
        <div
          className="project-wing-top-bar-title-value"
          data-slot="project-wing-top-bar-title-value"
        >
          {titleContent}
        </div>
      ) : (
        <h2
          className="project-wing-top-bar-title-value"
          data-slot="project-wing-top-bar-title-value"
        >
          {title}
        </h2>
      )}
      {description ? (
        <div
          className="project-wing-top-bar-title-description"
          data-slot="project-wing-top-bar-title-description"
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectWingTopBarActionCluster({
  children,
  wideOnly = false,
  className,
}: {
  children: ReactNode;
  wideOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`project-wing-top-bar-action-cluster${wideOnly ? " project-wing-top-bar-action-cluster--wide-only" : ""}${className ? ` ${className}` : ""}`}
      data-slot="project-wing-top-bar-action-cluster"
    >
      {children}
    </div>
  );
}

export function ProjectWingTopBarStatusIcon({
  children,
  hasStatus = false,
  statusSlot = "project-wing-top-bar-status-dot",
}: {
  children: ReactNode;
  hasStatus?: boolean;
  statusSlot?: string;
}) {
  return (
    <span
      className="project-wing-top-bar-status-icon"
      data-slot="project-wing-top-bar-status-icon"
    >
      {children}
      {hasStatus ? (
        <span
          className="project-wing-top-bar-status-dot bg-destructive"
          data-slot={statusSlot}
        />
      ) : null}
    </span>
  );
}

export function ProjectWingTopBarInboxIcon({
  children,
  hasUnread = false,
}: {
  children: ReactNode;
  hasUnread?: boolean;
}) {
  return (
    <ProjectWingTopBarStatusIcon
      hasStatus={hasUnread}
      statusSlot="project-wing-top-bar-inbox-unread-dot"
    >
      {children}
    </ProjectWingTopBarStatusIcon>
  );
}

export function ProjectWingTopBarMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`project-wing-top-bar-meta${className ? ` ${className}` : ""}`}
      data-slot="project-wing-top-bar-meta"
    >
      {children}
    </span>
  );
}
