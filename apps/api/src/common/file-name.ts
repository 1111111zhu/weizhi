export function normalizeUploadedFileName(fileName: string) {
  const decoded = Buffer.from(fileName, "latin1").toString("utf-8");
  if (
    decoded &&
    !decoded.includes("\uFFFD") &&
    mojibakeScore(decoded) < mojibakeScore(fileName)
  ) {
    return decoded.normalize("NFC");
  }
  return fileName.normalize("NFC");
}

export function buildInlineContentDisposition(fileName: string) {
  return buildContentDisposition("inline", fileName);
}

export function buildAttachmentContentDisposition(fileName: string) {
  return buildContentDisposition("attachment", fileName);
}

function buildContentDisposition(
  disposition: "attachment" | "inline",
  fileName: string
) {
  const normalized = stripHeaderUnsafeCharacters(
    normalizeUploadedFileName(fileName)
  );
  const safeName = normalized.trim() || "file";
  const asciiFallback = [...safeName]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 0x20 &&
        codePoint <= 0x7e &&
        character !== '"' &&
        character !== "\\" &&
        character !== "/" &&
        character !== ";"
        ? character
        : "_";
    })
    .join("");
  const encodedName = encodeURIComponent(safeName).replaceAll(
    /['()*]/g,
    (character) =>
      `%${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}

function stripHeaderUnsafeCharacters(value: string) {
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        codePoint <= 0x1f ||
        codePoint === 0x7f ||
        (codePoint >= 0x80 && codePoint <= 0x9f)
      );
    })
    .join("");
}

function mojibakeScore(value: string) {
  let score = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0x80 && codePoint <= 0x9f) {
      score += 4;
    }
  }
  if (
    /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(value)
  ) {
    score += 2;
  }
  if (value.includes("\uFFFD")) {
    score += 8;
  }
  return score;
}
