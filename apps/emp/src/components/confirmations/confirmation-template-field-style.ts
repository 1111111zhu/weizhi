import { DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE } from "@project-wing/shared";
import type {
  ConfirmationTemplateFontFamily,
  ConfirmationTemplateTextStyle,
} from "@project-wing/shared";
import type { CSSProperties } from "react";

export type ConfirmationTemplateTextAlign = "left" | "center" | "right";

export function getConfirmationTemplateFlexAlignmentCss(
  textAlign: ConfirmationTemplateTextAlign = "left"
): Pick<CSSProperties, "justifyContent" | "textAlign"> {
  return {
    justifyContent:
      textAlign === "center"
        ? "center"
        : textAlign === "right"
          ? "flex-end"
          : "flex-start",
    textAlign,
  };
}

export function getConfirmationTemplateFieldTextStyleCss(
  textStyle: ConfirmationTemplateTextStyle | undefined,
  pageHeight: number,
  pageScale: number | undefined,
  pageWidth: number,
  fieldHeight: number,
  fieldWidth: number,
  value: string,
  multiline = false
): CSSProperties {
  const resolvedStyle = {
    ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
    ...textStyle,
  };
  const baseFontSize =
    pageScale === undefined
      ? (resolvedStyle.fontSize / 900) * pageHeight
      : resolvedStyle.fontSize * pageScale;
  const normalizedValue = value.replaceAll(/\s+/gu, " ").trim();
  const renderFontFamily = getTemplateFieldRenderFontFamily(
    resolvedStyle,
    normalizedValue
  );
  const fontSize = multiline
    ? baseFontSize
    : fitTemplateFieldFontSize({
        fontFamily: renderFontFamily,
        fontSize: baseFontSize,
        fontStyle: resolvedStyle.italic ? "italic" : "normal",
        fontWeight: resolvedStyle.bold ? 700 : 400,
        maxHeight: Math.max(4, fieldHeight * pageHeight - 2),
        maxWidth: Math.max(4, fieldWidth * pageWidth - 8),
        text: normalizedValue,
      });
  return {
    ...(multiline
      ? {
          whiteSpace: "pre-wrap" as const,
          overflowWrap: "anywhere" as const,
          overflowY: "auto" as const,
        }
      : {}),
    backgroundColor: resolvedStyle.backgroundColor,
    color: resolvedStyle.textColor,
    fontFamily: renderFontFamily,
    fontSize: `${fontSize}px`,
    fontStyle: resolvedStyle.italic ? "italic" : "normal",
    fontWeight: resolvedStyle.bold ? 700 : 400,
    lineHeight: 1,
    textDecoration: resolvedStyle.underline ? "underline" : "none",
  };
}

function getTemplateFieldRenderFontFamily(
  textStyle: ConfirmationTemplateTextStyle,
  text: string
): ConfirmationTemplateFontFamily {
  return /[\u2E80-\u2FFF\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/u.test(text)
    ? "Noto Sans SC"
    : textStyle.fontFamily;
}

function fitTemplateFieldFontSize({
  fontFamily,
  fontSize,
  fontStyle,
  fontWeight,
  maxHeight,
  maxWidth,
  text,
}: {
  fontFamily: ConfirmationTemplateFontFamily;
  fontSize: number;
  fontStyle: CSSProperties["fontStyle"];
  fontWeight: CSSProperties["fontWeight"];
  maxHeight: number;
  maxWidth: number;
  text: string;
}) {
  if (!text.trim()) {
    return fontSize;
  }
  let fittedSize = fontSize;
  while (
    fittedSize > 4 &&
    (fittedSize > maxHeight ||
      measureTemplateFieldText(text, {
        fontFamily,
        fontSize: fittedSize,
        fontStyle,
        fontWeight,
      }) > maxWidth)
  ) {
    fittedSize = Math.max(4, fittedSize - 0.5);
  }
  return fittedSize;
}

let templateTextMeasureContext: CanvasRenderingContext2D | null | undefined;

function measureTemplateFieldText(
  text: string,
  style: Pick<
    CSSProperties,
    "fontFamily" | "fontSize" | "fontStyle" | "fontWeight"
  >
) {
  if (templateTextMeasureContext === undefined) {
    try {
      templateTextMeasureContext =
        typeof document === "undefined" ||
        typeof CanvasRenderingContext2D === "undefined"
          ? null
          : document.createElement("canvas").getContext("2d");
    } catch {
      templateTextMeasureContext = null;
    }
  }
  if (templateTextMeasureContext) {
    templateTextMeasureContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px "${style.fontFamily}"`;
    return templateTextMeasureContext.measureText(text).width;
  }
  const characterUnits = [...text].reduce(
    (total, character) =>
      total + ((character.codePointAt(0) ?? 0) > 0xff ? 1 : 0.62),
    0
  );
  return characterUnits * Number(style.fontSize) * 0.72;
}
