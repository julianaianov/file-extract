"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContextModal } from "./context-modal";

interface Line {
  num: number;
  text: string;
}
interface ContextResult {
  before: Line[];
  match: Line;
  after: Line[];
}

interface ApiResponse {
  file: { id: number; filename: string; uploadId: number } | null;
  query: string;
  window: number;
  totalMatches: number;
  results: ContextResult[];
  error?: string;
}

export function ContextSearch({uploadId}: {uploadId:number}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);


  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setSelectedIdx(null);
    try {
      const p = new URLSearchParams();
      p.set("q", q.trim());
      p.set("window", "2");
      if (uploadId) p.set("uploadId", String(uploadId));
      const res = await fetch(`/api/context?${p.toString()}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch {
      setData({
        file: null,
        query: q,
        window: 5,
        totalMatches: 0,
        results: [],
        error: "Não foi possível buscar o contexto. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="context-section">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Encontre a conversa por trás das palavras
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Digite o termo (ex: pagamento, endereço, etc.)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button onClick={search} disabled={loading || !q.trim()}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {data && !data.error && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            {data.totalMatches} ocorrência(s) em{" "}
            {data.file?.filename || "conversa"}.
            {data.totalMatches > 0 && " Clique para ver o contexto."}
          </p>
          <div className="grid gap-2">
            {data.results.map((r, i) => {
              const start = r.before[0]?.num ?? r.match.num;
              const end = r.after.at(-1)?.num ?? r.match.num;
              const snippetBefore = r.before.at(-1)?.text ?? "";
              const snippetAfter = r.after[0]?.text ?? "";
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className="w-full rounded-md border border-border p-3 text-left hover:bg-secondary/60"
                  title="Ver contexto"
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    Linhas {start}–{end}
                  </div>
                  <div className="space-y-1 font-mono text-[13px] leading-6">
                    {snippetBefore && (
                      <div className="text-foreground/80 line-clamp-1">
                        … {snippetBefore}
                      </div>
                    )}
                    <div className="bg-warning/20 text-foreground px-1 rounded line-clamp-1">
                      {r.match.text}
                    </div>
                    {snippetAfter && (
                      <div className="text-foreground/80 line-clamp-1">
                        {snippetAfter} …
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {data.results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </div>
            )}
          </div>
        </div>
      )}

      {data?.error && (
        <p className="mt-3 text-sm text-destructive">{data.error}</p>
      )}

      {selectedIdx !== null && data && (
        <ContextModal
          query={q}
          filename={data.file?.filename}
          result={data.results[selectedIdx]}
          onClose={() => setSelectedIdx(null)}
        />
      )}
    </section>
  );
}
