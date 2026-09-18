export type ConfirmationTemplateLayoutText = {
  height: number;
  page: number;
  width: number;
  x: number;
  y: number;
};

export const CONFIRMATION_TEMPLATE_FONT_FAMILIES = [
  "Noto Sans SC",
  "Noto Sans",
  "Liberation Sans",
  "Liberation Serif",
  "Arial",
  "Microsoft YaHei",
  "Times New Roman",
] as const;

export type ConfirmationTemplateFontFamily =
  (typeof CONFIRMATION_TEMPLATE_FONT_FAMILIES)[number];

export const CONFIRMATION_TEMPLATE_FONT_SIZES = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32,
] as const;

export type ConfirmationTemplateFontSize =
  (typeof CONFIRMATION_TEMPLATE_FONT_SIZES)[number];

export type ConfirmationTemplateTextStyle = {
  backgroundColor?: string;
  bold: boolean;
  fontFamily: ConfirmationTemplateFontFamily;
  fontSize: ConfirmationTemplateFontSize;
  italic: boolean;
  textColor?: string;
  underline: boolean;
};

/** Initial highlighter color for authored document content, independent of the app theme. */
export const DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR = "#FFF59D";

export const DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE: ConfirmationTemplateTextStyle =
  {
    bold: false,
    backgroundColor: "transparent",
    fontFamily: "Microsoft YaHei",
    fontSize: 12,
    italic: false,
    textColor: "#000000",
    underline: false,
  };
