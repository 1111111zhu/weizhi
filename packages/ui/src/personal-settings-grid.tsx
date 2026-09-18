import type { ReactNode } from "react";

import { cn } from "./utils";

export function PersonalSettingsGrid({
  appearanceControl,
  appearanceLabel,
  className,
  fontSizeControl,
  fontSizeLabel,
  languageControl,
  languageLabel,
}: {
  appearanceControl: ReactNode;
  appearanceLabel: ReactNode;
  className?: string;
  fontSizeControl: ReactNode;
  fontSizeLabel: ReactNode;
  languageControl: ReactNode;
  languageLabel: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[max-content_1.25rem_max-content] items-center gap-y-4",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="bg-border/70 col-start-2 row-span-3 row-start-1 w-px self-stretch justify-self-center"
      />
      <PersonalSettingsRow label={languageLabel} control={languageControl} />
      <PersonalSettingsRow
        label={appearanceLabel}
        control={appearanceControl}
      />
      <PersonalSettingsRow label={fontSizeLabel} control={fontSizeControl} />
    </div>
  );
}

function PersonalSettingsRow({
  control,
  label,
}: {
  control: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="contents">
      <div className="text-foreground col-start-1 text-right text-xs font-normal">
        {label}
      </div>
      <div className="col-start-3 min-w-0 justify-self-start">{control}</div>
    </div>
  );
}
