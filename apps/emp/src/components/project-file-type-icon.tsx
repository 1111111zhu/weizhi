"use client";

import { ProjectWingFileTypeIcon } from "@project-wing/ui";
import { useLayoutEffect, useRef, useState } from "react";

export function ProjectFileTypeIcon({
  fileName,
  className,
  iconClassName,
  "data-icon": dataIcon,
}: {
  fileName: string;
  className?: string;
  iconClassName?: string;
  "data-icon"?: "inline-start" | "inline-end";
}) {
  return (
    <ProjectWingFileTypeIcon
      fileName={fileName}
      size="sm"
      data-icon={dataIcon}
      className={className}
      iconClassName={iconClassName}
    />
  );
}

function getElementGap(element: HTMLElement) {
  return Number.parseFloat(window.getComputedStyle(element).columnGap) || 0;
}

function getHorizontalPadding(element: HTMLElement) {
  const computedStyle = window.getComputedStyle(element);

  return (
    (Number.parseFloat(computedStyle.paddingLeft) || 0) +
    (Number.parseFloat(computedStyle.paddingRight) || 0)
  );
}

export function ResponsiveProjectFileIdentity({
  fileName,
}: {
  fileName: string;
}) {
  const identityRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [showFileName, setShowFileName] = useState(false);

  useLayoutEffect(() => {
    const identity = identityRef.current;
    const measure = measureRef.current;
    const toolbar = identity?.closest<HTMLElement>(
      "[data-file-identity-toolbar]"
    );
    const leading = identity?.closest<HTMLElement>(
      "[data-file-identity-leading]"
    );
    const trailing = toolbar?.querySelector<HTMLElement>(
      "[data-file-identity-trailing]"
    );

    if (
      !identity ||
      !measure ||
      !toolbar ||
      !leading ||
      !trailing ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    const updateVisibility = () => {
      const nameWidth = measure.getBoundingClientRect().width;
      const renderedName = identity.querySelector("[data-file-identity-name]");
      const currentNameWidth = renderedName
        ? nameWidth + getElementGap(identity)
        : 0;
      const leadingWithoutName =
        leading.getBoundingClientRect().width - currentNameWidth;
      const requiredWidth =
        getHorizontalPadding(toolbar) +
        leadingWithoutName +
        getElementGap(toolbar) +
        trailing.getBoundingClientRect().width +
        getElementGap(identity) +
        nameWidth;

      setShowFileName(requiredWidth <= toolbar.clientWidth);
    };
    const observer = new ResizeObserver(updateVisibility);

    observer.observe(toolbar);
    observer.observe(leading);
    observer.observe(trailing);
    observer.observe(measure);
    updateVisibility();

    return () => observer.disconnect();
  }, []);

  return (
    <span ref={identityRef} className="flex shrink-0 items-center gap-2">
      <ProjectFileTypeIcon
        fileName={fileName}
        className="size-5"
        iconClassName="size-5"
      />
      {showFileName ? (
        <span
          data-file-identity-name
          className="text-sm font-medium whitespace-nowrap"
        >
          {fileName}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0 overflow-hidden"
      >
        <span
          ref={measureRef}
          className="block w-max text-sm font-medium whitespace-nowrap"
        >
          {fileName}
        </span>
      </span>
    </span>
  );
}
