import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2FieldTemplate,
  SmartFormV2Response,
} from "@project-wing/shared";
import { isSmartFormV2ExpressionTrue } from "@project-wing/shared";

import { cn } from "@/lib/utils";

export function SmartFormV2RequiredIndicator({
  required,
  requiredLabel,
  optionalLabel,
  className,
  decorative = false,
}: {
  required: boolean;
  requiredLabel: string;
  optionalLabel: string;
  className?: string;
  decorative?: boolean;
}) {
  const label = required ? requiredLabel : optionalLabel;
  if (!required) {
    return decorative ? null : (
      <span
        className={cn("sr-only", className)}
        data-smart-form-required-state="optional"
      >
        {optionalLabel}
      </span>
    );
  }
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold leading-none",
        "text-destructive",
        className
      )}
      data-smart-form-required-state="required"
      title={label}
    >
      <span aria-hidden="true">*</span>
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}

export function isSmartFormV2FieldRequired(
  behavior: Pick<SmartFormV2FieldTemplate, "required" | "requiredWhen">,
  definition: SmartFormV2CompiledDefinition,
  response?: SmartFormV2Response
) {
  return (
    behavior.required === true ||
    (response !== undefined &&
      behavior.requiredWhen !== undefined &&
      isSmartFormV2ExpressionTrue(definition, response, behavior.requiredWhen))
  );
}
