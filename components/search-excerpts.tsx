"use client";
import type { SearchContext } from "@/lib/search-context";
export function highlight(text: string, keyword: string) {
  const result = [];
  const lower = text.toLocaleLowerCase(), needle = keyword.toLocaleLowerCase();
  let start = 0, index = lower.indexOf(needle);
  if (!needle) return text;
  while (index !== -1) {
    result.push(text.slice(start, index), <mark key={index} className="rounded bg-lime-300 px-0.5 text-slate-950">{text.slice(index, index + keyword.length)}</mark>);
    start = index + keyword.length;
    index = lower.indexOf(needle, start);
  }
  result.push(text.slice(start));
  return result;
}
export function SearchExcerpts({ contexts, keyword }: { contexts: SearchContext[]; keyword: string }) {
  return <div className="search-excerpts" aria-label="Trechos encontrados">
    {contexts.length === 0 ? <p className="text-xs text-cyan-300">Encontrado no nome do arquivo.</p> : contexts.map((context, index) => <div key={index} className="rounded-lg border border-cyan-300/15 bg-slate-950/50 p-3">
      <p className="mb-2 text-[10px] text-cyan-300">{context.source === "transcription" ? "Transcrição" : "Conteúdo"} · linhas {context.lines[0].number}–{context.lines.at(-1)!.number}</p>
      {context.lines.map(line => <div key={line.number} className="flex gap-3 text-xs leading-6">
        <span className="w-7 shrink-0 select-none text-right text-slate-500" aria-label={"Linha " + line.number}>{line.number}</span>
        <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-slate-200">{highlight(line.text, keyword) || "\u00a0"}</span>
      </div>)}
    </div>)}
  </div>;
}
