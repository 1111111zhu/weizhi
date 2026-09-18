import type { ConfirmationTemplateDesign } from "../../api/client";
import { getConfirmationAuxiliaryCopy } from "../../i18n/confirmation-auxiliary";

export function ConfirmationTemplateLibraryFieldOverlay({
  designSchema,
  pageNumber,
  locale = "en-US",
}: {
  designSchema: ConfirmationTemplateDesign | null | undefined;
  pageNumber: number;
  locale?: string;
}) {
  const fields =
    designSchema?.fields.filter((field) => field.page === pageNumber) ?? [];
  if (fields.length === 0) {
    return null;
  }

  return (
    <svg
      aria-label={getConfirmationAuxiliaryCopy(locale).savedFields}
      className="pointer-events-none absolute inset-0 z-40 h-full w-full"
      data-testid={`template-library-preview-overlay-page-${pageNumber}`}
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      {fields.map((field) => {
        const clipPathId = `template-library-preview-clip-${field.id}`;
        const placeholder = field.placeholder.trim();
        return (
          <g key={field.id}>
            <defs>
              <clipPath id={clipPathId}>
                <rect
                  height={field.height}
                  width={field.width}
                  x={field.x}
                  y={field.y}
                />
              </clipPath>
            </defs>
            <rect
              className={
                field.kind === "MASK"
                  ? "fill-white stroke-destructive"
                  : "fill-white stroke-primary"
              }
              data-testid={`template-library-preview-field-${field.id}`}
              height={field.height}
              rx={0.004}
              strokeWidth={0.002}
              width={field.width}
              x={field.x}
              y={field.y}
            />
            {placeholder && field.kind !== "MASK" ? (
              <text
                className="fill-slate-500"
                clipPath={`url(#${clipPathId})`}
                dominantBaseline="middle"
                fontFamily={field.textStyle?.fontFamily}
                fontSize={(field.textStyle?.fontSize ?? 14) / 900}
                fontStyle={field.textStyle?.italic ? "italic" : "normal"}
                fontWeight={field.textStyle?.bold ? "700" : "400"}
                textDecoration={
                  field.textStyle?.underline ? "underline" : "none"
                }
                x={field.x + 0.006}
                y={field.y + field.height / 2}
              >
                {placeholder}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
