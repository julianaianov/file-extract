'use client';

import React from "react"

import { useState, useCallback } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onUploadComplete?: (result: { uploadId: number; totalFiles: number }) => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.zip')) {
      setSelectedFile(files[0]);
      setUploadStatus('idle');
      setMessage('');
    } else {
      setMessage('Por favor, selecione um arquivo ZIP');
      setUploadStatus('error');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files[0].name.endsWith('.zip')) {
        setSelectedFile(files[0]);
        setUploadStatus('idle');
        setMessage('');
      } else {
        setMessage('Por favor, selecione um arquivo ZIP');
        setUploadStatus('error');
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (customName.trim()) {
        formData.append('customName', customName.trim());
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus('success');
        setMessage(`Processado com sucesso! ${result.totalFiles} arquivos extraídos.`);
        setSelectedFile(null);
        onUploadComplete?.({ uploadId: result.uploadId, totalFiles: result.totalFiles });
      } else {
        setUploadStatus('error');
        setMessage(result.error || 'Erro ao fazer upload');
      }
    } catch {
      setUploadStatus('error');
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all',
          isDragging
            ? 'border-accent bg-accent/10'
            : 'border-border bg-card hover:border-muted-foreground/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        <input
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {isUploading ? (
            <Loader2 className="h-12 w-12 animate-spin text-accent" />
          ) : uploadStatus === 'success' ? (
            <CheckCircle2 className="h-12 w-12 text-success" />
          ) : uploadStatus === 'error' ? (
            <XCircle className="h-12 w-12 text-destructive" />
          ) : (
            <Upload className="h-12 w-12 text-muted-foreground" />
          )}

          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">
              {isUploading
                ? 'Processando arquivo...'
                : selectedFile
                  ? selectedFile.name
                  : 'Arraste um arquivo ZIP aqui'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isUploading
                ? 'Por favor, aguarde'
                : selectedFile
                  ? formatFileSize(selectedFile.size)
                  : 'ou clique para selecionar'}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <p
          className={cn(
            'mt-3 text-sm',
            uploadStatus === 'success' ? 'text-success' : 'text-destructive'
          )}
        >
          {message}
        </p>
      )}

      {selectedFile && !isUploading && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Nome do upload (opcional)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex gap-3">
            <Button onClick={handleUpload} className="flex-1">
            Processar Arquivo
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setMessage('');
                setUploadStatus('idle');
                setCustomName('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
