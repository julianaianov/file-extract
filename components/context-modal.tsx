'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useMemo } from 'react';

interface Line {
  num: number;
  text: string;
}

interface ContextResult {
  before: Line[];
  match: Line;
  after: Line[];
}

interface ContextModalProps {
  query: string;
  filename?: string;
  result: ContextResult;
  onClose: () => void;
}

export function ContextModal({ query, filename, result, onClose }: ContextModalProps) {
  const highlight = (text: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return (
      <>
        {before}
        <span className="bg-warning/30 px-1 rounded">{match}</span>
        {after}
      </>
    );
  };

  const allText = useMemo(() => {
    const before = result.before.map((l) => `${l.num}\t${l.text}`).join('\n');
    const center = `${result.match.num}\t${result.match.text}`;
    const after = result.after.map((l) => `${l.num}\t${l.text}`).join('\n');
    return [before, center, after].filter(Boolean).join('\n');
  }, [result]);

  const renderLine = (l: Line, isMatch = false) => (
    <div
      key={l.num}
      className={`grid grid-cols-[68px_1fr] items-start gap-3 rounded-md px-3 py-1 ${
        isMatch ? 'bg-secondary/70 ring-1 ring-warning/30' : ''
      }`}
    >
      <div className="text-xs text-muted-foreground tabular-nums text-right pr-2 border-r border-border">
        {l.num}
      </div>
      <div className={`text-sm break-words leading-6 ${isMatch ? 'text-foreground' : 'text-foreground/90'}`}>
        <pre className="whitespace-pre-wrap font-mono text-[13px]">
          {isMatch ? highlight(l.text) : l.text}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-card shadow-lg mx-4">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Contexto em</div>
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">{filename || 'Conversa'}</h3>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">
                termo: <span className="font-mono">{query}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(allText)}
              title="Copiar bloco"
            >
              Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} title="Fechar">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="space-y-1">
            {result.before.length > 0 && (
              <div className="px-3 py-1 text-xs text-muted-foreground">… anterior</div>
            )}
            {result.before.map((l) => renderLine(l))}
            <div className="relative">{renderLine(result.match, true)}</div>
            {result.after.map((l) => renderLine(l))}
            {result.after.length > 0 && (
              <div className="px-3 py-1 text-xs text-muted-foreground">posterior …</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

