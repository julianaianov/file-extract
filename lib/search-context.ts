export interface SearchContext {
  source: "content" | "transcription";
  lines: { number: number; text: string; match: boolean }[];
}
export function searchContext(text: string | null, keyword: string, source: SearchContext["source"]): SearchContext[] {
  if (!text || !keyword) return [];
  const lines = text.split(/\r\n|\n|\r/);
  const matches = lines.map(line => line.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()));
  const windows: { start: number; end: number }[] = [];
  matches.forEach((match, index) => {
    if (!match) return;
    const start = Math.max(0, index - 2), end = Math.min(lines.length - 1, index + 2);
    const last = windows.at(-1);
    if (last && start <= last.end + 1) last.end = Math.max(last.end, end);
    else windows.push({ start, end });
  });
  return windows.map(({ start, end }) => ({ source, lines: lines.slice(start, end + 1).map((text, offset) => ({ number: start + offset + 1, text, match: matches[start + offset] })) }));
}
