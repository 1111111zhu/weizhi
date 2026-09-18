import { Check, Minus } from "lucide-react";

export function CmpBooleanIndicator({
  value,
  label,
  yesLabel,
  noLabel,
}: {
  value: boolean;
  label: string;
  yesLabel: string;
  noLabel: string;
}) {
  const accessibleLabel = `${label}: ${value ? yesLabel : noLabel}`;
  const Icon = value ? Check : Minus;

  return (
    <span
      aria-label={accessibleLabel}
      className={`cmp-boolean-indicator${value ? " is-yes" : " is-no"}`}
      role="img"
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
