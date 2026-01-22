'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, FileText, Mic, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ExtractedFile {
  id: number;
  filename: string;
  file_type: 'text' | 'audio' | 'image' | 'other';
  mime_type: string | null;
  transcription: string | null;
  transcription_status: string;
}

interface FilePreviewProps {
  file: ExtractedFile;
  onClose: () => void;
}

interface ContentData {
  type: string;
  content?: string;
  data?: string;
  mimeType?: string;
  transcription?: string;
  transcriptionStatus?: string;
  message?: string;
  ocrText?: string;
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const [content, setContent] = useState<ContentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/files/${file.id}?action=content`);
        const data = await response.json();

        if (response.ok) {
          setContent(data);
        } else {
          setError(data.error || 'Erro ao carregar conteudo');
        }
      } catch {
        setError('Erro de conexao');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [file.id]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-64 items-center justify-center text-destructive">
          <p>{error}</p>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <p>Conteudo nao disponivel</p>
        </div>
      );
    }

    switch (content.type) {
      case 'text':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-5 w-5" />
              <span>Conteudo de Texto</span>
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-secondary p-4 text-sm text-foreground whitespace-pre-wrap font-mono">
              {content.content || 'Arquivo vazio'}
            </pre>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              <span>Visualizacao de Imagem</span>
              <div className="ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExtracting}
                  onClick={async () => {
                    try {
                      setIsExtracting(true);
                      const res = await fetch('/api/ocr', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: file.id }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        toast.error(data?.error || 'Falha ao extrair texto');
                        return;
                      }
                      toast.success('Texto extraido com sucesso');
                      // Recarregar o conteúdo para exibir o texto extraído
                      const refresh = await fetch(`/api/files/${file.id}?action=content`);
                      const freshData = await refresh.json();
                      if (refresh.ok) setContent(freshData);
                    } catch {
                      toast.error('Erro de rede ao extrair texto');
                    } finally {
                      setIsExtracting(false);
                    }
                  }}
                >
                  {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extrair Texto'}
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={content.data || "/placeholder.svg"}
                alt={file.filename}
                className="max-h-[60vh] max-w-full rounded-lg object-contain"
              />
            </div>
            {content.ocrText && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Texto extraido (OCR):</p>
                <div className="rounded-lg bg-secondary p-4 text-sm text-foreground whitespace-pre-wrap">
                  {content.ocrText}
                </div>
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mic className="h-5 w-5" />
              <span>Reprodutor de Audio</span>
            </div>
            <audio controls className="w-full" src={content.data}>
              Seu navegador nao suporta o elemento de audio.
            </audio>
            {content.transcription && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Transcricao:</p>
                <div className="rounded-lg bg-secondary p-4 text-sm text-foreground">
                  {content.transcription}
                </div>
              </div>
            )}
            {content.transcriptionStatus === 'pending' && (
              <p className="text-sm text-muted-foreground italic">
                Transcricao pendente. Clique em Transcrever na lista de arquivos.
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>{content.message || 'Visualizacao nao disponivel para este tipo de arquivo'}</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-card p-6 shadow-lg mx-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{file.filename}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
