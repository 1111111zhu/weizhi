import {
  formatNumberWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";

export function buildNextWorkingPaperCode(
  nodeCode: string,
  existingPapers: { code: string }[]
) {
  if (isHierarchicalNumericFolderCode(nodeCode)) {
    return buildNextHierarchicalNumericFileCode(nodeCode, existingPapers);
  }
  const normalizedNodeCode = normalizeCodeWithoutDigitFour(nodeCode);
  const prefix = `${normalizedNodeCode}-F`;
  const maxIndex = existingPapers.reduce((max, paper) => {
    const paperCode = normalizeCodeWithoutDigitFour(paper.code);
    if (!paperCode.startsWith(prefix)) {
      return max;
    }
    const suffix = paperCode.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) {
      return max;
    }
    return Math.max(max, Number(suffix));
  }, 0);
  return `${prefix}${formatNumberWithoutDigitFour(maxIndex + 1, 3)}`;
}

/**
 * Numeric folders use a stable, human-readable file sequence (1000.1,
 * 1000.2).  Legacy folder schemes retain their existing -F001 convention.
 */
function buildNextHierarchicalNumericFileCode(
  nodeCode: string,
  existingPapers: { code: string }[]
) {
  const prefix = normalizeHierarchicalNumericCode(nodeCode);
  const expression = new RegExp(`^${escapeRegExp(prefix)}\\.(\\d+)$`);
  const maxIndex = existingPapers.reduce((max, paper) => {
    const match = paper.code.trim().match(expression);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}.${maxIndex + 1}`;
}

export function isHierarchicalNumericFolderCode(value: string) {
  return /^\d{1,4}$|^\d+(?:-\d+)+$/.test(value.trim());
}

export function isHierarchicalNumericWorkingPaperCode(value: string) {
  return /^\d{1,4}\.\d+$|^\d+(?:-\d+)+\.\d+$/.test(
    value
      .trim()
      .replaceAll(/\s*[-.]\s*/g, (separator) =>
        separator.includes(".") ? "." : "-"
      )
  );
}

export function normalizeHierarchicalNumericCode(value: string) {
  return value.trim().replaceAll(/\s*-\s*/g, "-");
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
