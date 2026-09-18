import type { ComponentProps } from "react";

export type ProjectWingDevLogoVariant = "on-light" | "on-dark";

const PROJECT_WING_DEV_LOGO_SOURCES: Record<ProjectWingDevLogoVariant, string> =
  {
    "on-dark": "/brand/icon-black-green.svg",
    "on-light": "/brand/icon-white-green.svg",
  };

export function ProjectWingDevLogo({
  variant = "on-light",
  alt = "",
  ...props
}: {
  variant?: ProjectWingDevLogoVariant;
} & Omit<ComponentProps<"img">, "alt" | "src"> & { alt?: string }) {
  return (
    <img
      {...props}
      alt={alt}
      data-slot="project-wing-dev-logo"
      src={PROJECT_WING_DEV_LOGO_SOURCES[variant]}
    />
  );
}
