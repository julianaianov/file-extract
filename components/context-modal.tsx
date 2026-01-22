'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
        <span className="bg-warning/30 px-1">{match}</span>
        {after}
      </>
    );
  };

  const renderLine = (l: Line, isMatch = false) => (
    <div key={l.num} className={`grid grid-cols-[56px_1fr] items-start gap-3 rounded-md px-3 py-1 ${isMatch ? 'bg-secondary' : ''}`}>
      <div className="text-xs text-muted-foreground tabular-nums">{l.num}</div>
      <div className="text-sm text-foreground break-words">{isMatch ? highlight(l.text) : l.text}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-card p-6 shadow-lg mx-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Contexto em</p>
            <h3 className="text-lg font-semibold text-foreground">{filename || 'Conversa'}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-1">
          {result.before.map((l) => renderLine(l))}
          {renderLine(result.match, true)}
          {result.after.map((l) => renderLine(l))}
        </div>
      </div>
    </div>
  );
}

