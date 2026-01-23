'use client';

import { useState } from 'react';
import { FileText, Mic, ImageIcon, File, Download, Eye, Loader2, Trash2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FilePreview } from './file-preview';
import { toast } from 'sonner';

interface ExtractedFile {
  id: number;
  upload_id: number;
  filename: string;
  file_path: string;
  file_type: 'text' | 'audio' | 'image' | 'other';
  file_size: number;
  mime_type: string | null;
  extracted_date: string;
  content_text: string | null;
  transcription: string | null;
  transcription_status: 'pending' | 'processing' | 'completed' | 'error' | 'not_applicable';
  upload_name?: string;
}

interface FileListProps {
  files: ExtractedFile[];
  isLoading?: boolean;
  onTranscribe?: (fileId: number) => void;
  transcribingIds?: number[];
  onChanged?: () => void;
}

const fileTypeIcons = {
  text: FileText,
  audio: Mic,
  image: ImageIcon,
  other: File,
};

const fileTypeTheme = {
  text: {
    icon: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
    cardBg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    ring: 'ring-blue-500/30',
  },
  audio: {
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    cardBg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    ring: 'ring-amber-500/30',
  },
  image: {
    icon: 'text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/20',
    cardBg: 'bg-fuchsia-500/5',
    border: 'border-fuchsia-500/20',
    ring: 'ring-fuchsia-500/30',
  },
  other: {
    icon: 'text-slate-400',
    iconBg: 'bg-slate-500/20',
    cardBg: 'bg-slate-500/5',
    border: 'border-slate-500/20',
    ring: 'ring-slate-500/30',
  },
} as const;

const transcriptionStatusLabels = {
  pending: 'Pendente',
  processing: 'Processando...',
  completed: 'Transcrito',
  error: 'Erro',
  not_applicable: '',
};

export function FileList({ files, isLoading, onTranscribe, transcribingIds = [], onChanged }: FileListProps) {
  const [previewFile, setPreviewFile] = useState<ExtractedFile | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTranscribing, setBulkTranscribing] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = async (file: ExtractedFile) => {
    const response = await fetch(`/api/files/${file.id}?action=download`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deleteOne = async (id: number) => {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSelectedIds((s) => s.filter((x) => x !== id));
      onChanged?.();
    }
  };

  const deleteSelected = async () => {
    for (const id of selectedIds) {
      // sequential to keep it simple
      // eslint-disable-next-line no-await-in-loop
      await fetch(`/api/files/${id}`, { method: 'DELETE' });
    }
    setSelectedIds([]);
    onChanged?.();
  };

  const transcribeMany = async (ids: number[]) => {
    if (ids.length === 0) return;
    setBulkTranscribing(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const id of ids) {
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: id }),
          });
          if (res.ok) ok++;
          else fail++;
        } catch {
          fail++;
        }
        onChanged?.();
      }
      if (fail === 0) {
        toast.success(`Transcrição concluída para ${ok} áudio(s).`);
      } else {
        toast.error(`Transcrição finalizada: ${ok} sucesso(s), ${fail} falha(s).`);
      }
    } finally {
      setBulkTranscribing(false);
    }
  };

  const transcribeAllAudiosChronologically = async () => {
    const queue = files
      .filter((f) => f.file_type === 'audio')
      .sort((a, b) => new Date(a.extracted_date).getTime() - new Date(b.extracted_date).getTime())
      .map((f) => f.id);
    await transcribeMany(queue);
  };

  const transcribeSelectedAudios = async () => {
    const queue = files
      .filter((f) => selectedIds.includes(f.id) && f.file_type === 'audio')
      .sort((a, b) => new Date(a.extracted_date).getTime() - new Date(b.extracted_date).getTime())
      .map((f) => f.id);
    await transcribeMany(queue);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <File className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Nenhum arquivo encontrado</p>
        <p className="text-sm text-muted-foreground">
          Faça upload de um arquivo ZIP ou ajuste os filtros de busca
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectionMode ? `${selectedIds.length} selecionado(s)` : ''}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectionMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedIds([]);
            }}
          >
            {selectionMode ? 'Sair seleção' : 'Selecionar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={transcribeAllAudiosChronologically}
            disabled={bulkTranscribing || transcribingIds.length > 0}
            title="Transcrever todos os áudios em ordem cronológica"
          >
            {bulkTranscribing ? 'Transcrevendo...' : 'Transcrever todos (áudio)'}
          </Button>
          {selectionMode && selectedIds.length > 0 && (
            <Button size="sm" variant="destructive" onClick={deleteSelected}>
              Excluir selecionados
            </Button>
          )}
          {selectionMode && selectedIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={transcribeSelectedAudios}
              disabled={bulkTranscribing || transcribingIds.length > 0}
              title="Transcrever apenas os áudios selecionados"
            >
              Transcrever selecionados (áudio)
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {files.map((file) => {
          const Icon = fileTypeIcons[file.file_type];
          const theme = fileTypeTheme[file.file_type];
          const isTranscribing = transcribingIds.includes(file.id);
          const isSelected = selectedIds.includes(file.id);

          return (
            <div
              key={file.id}
              className={cn(
                'group flex items-center gap-4 rounded-lg border p-4 transition hover:shadow-md',
                theme.cardBg,
                theme.border,
                'hover:ring-2',
                theme.ring
              )}
            >
              {selectionMode && (
                <button
                  className="text-muted-foreground"
                  onClick={() => toggleSelect(file.id)}
                  title={isSelected ? 'Desmarcar' : 'Selecionar'}
                >
                  {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </button>
              )}
              <div className={cn('rounded-lg p-3', theme.iconBg, theme.icon)}>
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{file.filename}</p>
                  {file.file_type === 'audio' && file.transcription_status !== 'not_applicable' && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        file.transcription_status === 'completed'
                          ? 'bg-success/20 text-success'
                          : file.transcription_status === 'processing'
                            ? 'bg-warning/20 text-warning'
                            : file.transcription_status === 'error'
                              ? 'bg-destructive/20 text-destructive'
                              : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {transcriptionStatusLabels[file.transcription_status]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{formatFileSize(file.file_size)}</span>
                  <span>-</span>
                  <span>{formatDate(file.extracted_date)}</span>
                  {file.upload_name && (
                    <>
                      <span>-</span>
                      <span className="truncate">{file.upload_name}</span>
                    </>
                  )}
                </div>
                {file.transcription && (
                  <p className="mt-2 text-sm text-foreground/80 line-clamp-2 italic">
                    {'"'}{file.transcription}{'"'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="ghost" onClick={() => deleteOne(file.id)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
                {file.file_type === 'image' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/ocr', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: file.id }),
                        });
                        if (res.ok) {
                          toast.success('Texto extraído com sucesso');
                          onChanged?.();
                        } else {
                          const data = await res.json().catch(() => ({}));
                          toast.error(data?.error || 'Falha ao extrair texto');
                        }
                      } catch (e) {
                        toast.error('Erro de rede ao extrair texto');
                      }
                    }}
                  >
                    Extrair Texto
                  </Button>
                )}
                {file.file_type === 'audio' &&
                  (file.transcription_status === 'pending' || file.transcription_status === 'error') &&
                  onTranscribe && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTranscribe(file.id)}
                      disabled={isTranscribing}
                    >
                      {isTranscribing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                      file.transcription_status === 'error' ? 'Tentar novamente' : 'Transcrever'
                      )}
                    </Button>
                  )}
                <Button size="sm" variant="ghost" onClick={() => setPreviewFile(file)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDownload(file)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}
