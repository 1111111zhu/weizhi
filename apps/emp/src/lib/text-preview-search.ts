export type TextPreviewSearchResult = {
  end: number;
  start: number;
};

export function findTextPreviewSearchResults(
  text: string,
  rawQuery: string
): TextPreviewSearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) {
    return [];
  }

  const normalizedText = text.toLocaleLowerCase();
  const results: TextPreviewSearchResult[] = [];
  let start = normalizedText.indexOf(query);

  while (start !== -1) {
    results.push({ start, end: start + query.length });
    start = normalizedText.indexOf(query, start + query.length);
  }

  return results;
}
