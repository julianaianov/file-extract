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

  const palette = [
    'text-emerald-400',
    'text-sky-400',
    'text-amber-400',
    'text-fuchsia-400',
    'text-rose-400',
    'text-violet-400',
    'text-lime-400',
    'text-orange-400',
  ];
  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  function findBestMatch(text: string, needle: string): { start: number; end: number } | null {
    const tl = text.toLowerCase();
    const nl = needle.toLowerCase();
    const idx = tl.indexOf(nl);
    if (idx !== -1) return { start: idx, end: idx + nl.length };
    // fallback: pick closest token
    const re = /\b[\p{L}\p{N}_]+\b/gu;
    let m: RegExpExecArray | null;
    let best: { d: number; s: number; e: number } | null = null;
    while ((m = re.exec(tl))) {
      const token = m[0];
      const d = levenshtein(token, nl);
      if (!best || d < best.d) best = { d, s: m.index, e: m.index + token.length };
    }
    if (best && best.d <= Math.max(1, Math.floor(Math.min(nl.length, 8) * 0.3))) {
      return { start: best.s, end: best.e };
    }
    return null;
  }

  function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function renderContentWithStyles(text: string, q: string) {
    // date [dd/mm/yyyy, hh:mm:ss]
    const dateMatch = text.match(/^\[(\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}:\d{2})\]\s*/);
    let rest = text;
    const parts: JSX.Element[] = [];
    if (dateMatch) {
      parts.push(<span key="date" className="text-sky-400">{`[${dateMatch[1]}] `}</span>);
      rest = text.slice(dateMatch[0].length);
    }
    // user "Name:" at start
    const userMatch = rest.match(/^([^:]{2,30}):\s*/);
    if (userMatch) {
      const user = userMatch[1].trim();
      const color = palette[hash(user) % palette.length];
      parts.push(
        <span key="user" className={`${color} font-semibold`}>
          {user}:{' '}
        </span>
      );
      rest = rest.slice(userMatch[0].length);
    }
    // fuzzy highlight term
    const range = q ? findBestMatch(rest, q) : null;
    if (!range) {
      parts.push(<span key="rest">{rest}</span>);
    } else {
      parts.push(
        <span key="pre">{rest.slice(0, range.start)}</span>,
        <span key="hl" className="bg-warning/30 px-1 rounded">
          {rest.slice(range.start, range.end)}
        </span>,
        <span key="post">{rest.slice(range.end)}</span>
      );
    }
    return parts;
  }

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
          {renderContentWithStyles(l.text, isMatch ? query : '')}
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

