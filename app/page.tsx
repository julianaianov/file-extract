'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { FileUpload } from '@/components/file-upload';
import { SearchFilters, type SearchFilters as SearchFiltersType } from '@/components/search-filters';
import { FileList } from '@/components/file-list';
import { StatsCards } from '@/components/stats-cards';
import { ContextSearch } from '@/components/context-search';
import { Archive } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Loading from './loading';

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

interface Stats {
  totalUploads: number;
  totalFiles: number;
  textFiles: number;
  audioFiles: number;
  imageFiles: number;
  pendingTranscriptions: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const [filters, setFilters] = useState<SearchFiltersType>({
    keyword: '',
    fileType: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '',
    timeTo: '',
    uploadId: null,
  });
  const [transcribingIds, setTranscribingIds] = useState<number[]>([]);
  const searchParams = useSearchParams();

  // Construir URL de busca com filtros
  const buildSearchUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.fileType) params.set('fileType', filters.fileType);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.timeFrom) params.set('timeFrom', filters.timeFrom);
    if (filters.timeTo) params.set('timeTo', filters.timeTo);
    if (filters.uploadId) params.set('uploadId', String(filters.uploadId));
    return `/api/files?${params.toString()}`;
  }, [filters]);

  // Buscar arquivos
  const { data: filesData, isLoading: filesLoading } = useSWR<{ files: ExtractedFile[] }>(
    buildSearchUrl(),
    fetcher,
    { refreshInterval: 5000 }
  );

  // Buscar estatísticas
  const { data: statsData } = useSWR<Stats>('/api/files?action=stats', fetcher, {
    refreshInterval: 10000,
  });

  const handleSearch = (newFilters: SearchFiltersType) => {
    setFilters(newFilters);
  };

  const handleUploadComplete = () => {
    // Atualizar dados após upload
    mutate(buildSearchUrl());
    mutate('/api/files?action=stats');
  };

  const handleTranscribe = async (fileId: number) => {
    setTranscribingIds((prev) => [...prev, fileId]);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      if (response.ok) {
        // Atualizar lista após transcrição
        mutate(buildSearchUrl());
        mutate('/api/files?action=stats');
      }
    } catch (error) {
      console.error('Erro na transcrição:', error);
    } finally {
      setTranscribingIds((prev) => prev.filter((id) => id !== fileId));
    }
  };

  // Atualizar busca quando filtros mudam
  useEffect(() => {
    mutate(buildSearchUrl());
  }, [buildSearchUrl]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="rounded-lg bg-accent p-2">
            <Archive className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">File Extractor</h1>
            <p className="text-sm text-muted-foreground">
              Processamento de arquivos ZIP com extração e transcrição
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Estatísticas */}
          {statsData && <StatsCards stats={statsData} />}

          {/* Upload */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Upload de Arquivo ZIP</h2>
            <FileUpload onUploadComplete={handleUploadComplete} />
          </section>

          {/* Busca e Filtros */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Buscar Arquivos</h2>
            <SearchFilters
              onSearch={handleSearch}
              isLoading={filesLoading}
              onDeleteUpload={async (uploadId) => {
                if (!confirm('Deseja excluir todos os arquivos deste upload?')) return;
                const res = await fetch(`/api/files/${uploadId}`, { method: 'DELETE' });
                if (res.ok) {
                  mutate(buildSearchUrl());
                  mutate('/api/files?action=stats');
                }
              }}
            />
          </section>

          {/* Busca de Contexto de Conversa */}
          <ContextSearch />

          {/* Lista de Arquivos */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Arquivos Extraídos
                {filesData?.files && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filesData.files.length} encontrados)
                  </span>
                )}
              </h2>
            </div>
            <Suspense fallback={<Loading />}>
              <FileList
                files={filesData?.files || []}
                isLoading={filesLoading}
                onTranscribe={handleTranscribe}
                transcribingIds={transcribingIds}
                onChanged={() => {
                  mutate(buildSearchUrl());
                  mutate('/api/files?action=stats');
                }}
              />
            </Suspense>
          </section>
        </div>
      </div>
    </main>
  );
}
