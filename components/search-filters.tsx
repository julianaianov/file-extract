'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, X, FileText, Mic, ImageIcon, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchFilters {
  keyword: string;
  fileType: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  uploadId?: number | null;
}

interface SearchFiltersProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
  onDeleteUpload?: (uploadId: number) => void;
}

const fileTypes = [
  { value: '', label: 'Todos', icon: File },
  { value: 'text', label: 'Texto', icon: FileText },
  { value: 'audio', label: 'Audio', icon: Mic },
  { value: 'image', label: 'Imagem', icon: ImageIcon },
];

export function SearchFilters({ onSearch, isLoading, onDeleteUpload }: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: '',
    fileType: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '',
    timeTo: '',
    uploadId: null,
  });
  const [uploads, setUploads] = useState<Array<{ id: number; original_name: string }>>([]);

  useEffect(() => {
    fetch('/api/files?action=uploads')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUploads(data);
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleClear = () => {
    const cleared: SearchFilters = {
      keyword: '',
      fileType: '',
      dateFrom: '',
      dateTo: '',
      timeFrom: '',
      timeTo: '',
      uploadId: null,
    };
    setFilters(cleared);
    onSearch(cleared);
  };

  const hasFilters =
    filters.keyword ||
    filters.fileType ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.timeFrom ||
    filters.timeTo ||
    filters.uploadId;

  return (
    <div className="space-y-4">
      {/* Barra de busca principal */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por palavras-chave..."
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? 'Buscando...' : 'Buscar'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(showAdvanced && 'bg-secondary')}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
        {hasFilters && (
          <Button variant="ghost" onClick={handleClear}>
            <X className="mr-2 h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Seleção de Upload */}
      <div className="flex items-center gap-3">
        <select
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          value={filters.uploadId ?? ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            setFilters({ ...filters, uploadId: val });
            onSearch({ ...filters, uploadId: val });
          }}
        >
          <option value="">Todos os uploads</option>
          {uploads.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id} - {u.original_name}
            </option>
          ))}
        </select>
        {filters.uploadId && onDeleteUpload && (
          <Button
            variant="outline"
            onClick={() => onDeleteUpload(filters.uploadId!)}
            title="Excluir todos os arquivos deste upload"
          >
            Excluir upload
          </Button>
        )}
      </div>

      {/* Filtros de tipo de arquivo */}
      <div className="flex flex-wrap gap-2">
        {fileTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => {
                setFilters({ ...filters, fileType: type.value });
                onSearch({ ...filters, fileType: type.value });
              }}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors',
                filters.fileType === type.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <Icon className="h-4 w-4" />
              {type.label}
            </button>
          );
        })}
      </div>

      {/* Filtros avançados */}
      {showAdvanced && (
        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Data Inicial</label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Data Final</label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Hora Inicial</label>
            <Input
              type="time"
              value={filters.timeFrom}
              onChange={(e) => setFilters({ ...filters, timeFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Hora Final</label>
            <Input
              type="time"
              value={filters.timeTo}
              onChange={(e) => setFilters({ ...filters, timeTo: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
