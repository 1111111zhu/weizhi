export function sanitizeEmailSubject(value: string) {
  return value.replaceAll(/[\r\n]+/g, " ").trim();
}
