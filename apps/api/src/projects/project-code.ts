export function createProjectCode(year: number, sequence: number): string {
  return `AUD-${year}-${String(sequence).padStart(4, "0")}`;
}

export function nextProjectSequence(
  existingCodes: string[],
  year: number
): number {
  const prefix = `AUD-${year}-`;
  const max = existingCodes
    .filter((code) => code.startsWith(prefix))
    .map((code) => Math.trunc(Number(code.slice(prefix.length))))
    .filter((value) => Number.isFinite(value))
    .reduce((highest, value) => Math.max(highest, value), 0);

  return max + 1;
}
