'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContextModal } from './context-modal';

interface Upload {
  id: number;
  original_name: string;
}

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

export function ContextSearch() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploadId, setUploadId] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/files?action=uploads')
      .then((r) => r.json())
      .then((arr) => Array.isArray(arr) && setUploads(arr))
      .catch(() => {});
  }, []);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setSelectedIdx(null);
    try {
      const p = new URLSearchParams();
      p.set('q', q.trim());
      p.set('window', '5');
      if (uploadId) p.set('uploadId', String(uploadId));
      const res = await fetch(`/api/context?${p.toString()}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Buscar Contexto da Conversa</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Digite o termo (ex: pagamento, endereço, etc.)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </div>
        <select
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          value={uploadId}
          onChange={(e) => setUploadId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Todos os uploads</option>
          {uploads.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id} - {u.original_name}
            </option>
          ))}
        </select>
        <Button onClick={search} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {data && !data.error && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            {data.totalMatches} ocorrência(s) em {data.file?.filename || 'conversa'}.
            {data.totalMatches > 0 && ' Clique para ver o contexto.'}
          </p>
          <div className="divide-y divide-border rounded-md border border-border">
            {data.results.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className="w-full p-3 text-left hover:bg-secondary"
                title="Ver contexto"
              >
                <div className="line-clamp-1 text-sm text-foreground">{r.match.text}</div>
                <div className="text-xs text-muted-foreground">
                  Linhas {r.before[0]?.num ?? r.match.num}–{(r.after.at(-1)?.num ?? r.match.num)}
                </div>
              </button>
            ))}
            {data.results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
            )}
          </div>
        </div>
      )}

      {data?.error && <p className="mt-3 text-sm text-destructive">{data.error}</p>}

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

