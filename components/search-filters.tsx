"use client";

import { useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  FileText,
  AudioLines,
  ImageIcon,
  Layers3,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export interface SearchFilters {
  keyword: string;
  fileType: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  uploadId?: number | null;
  transcriptionStatus?: string | null;
}
export const emptyFilters: SearchFilters = {
  keyword: "",
  fileType: "",
  dateFrom: "",
  dateTo: "",
  timeFrom: "",
  timeTo: "",
  uploadId: null,
  transcriptionStatus: null,
};
interface Props {
  filters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
  onDeleteUpload?: (id: number) => void;
}
const types = [
  { value: "", label: "Todos", icon: Layers3 },
  { value: "text", label: "Texto e PDF", icon: FileText },
  { value: "audio", label: "Áudio", icon: AudioLines },
  { value: "image", label: "Imagens", icon: ImageIcon },
  { value: "other", label: "Outros", icon: Layers3 },
];
export function SearchFilters({ filters, onSearch, onDeleteUpload }: Props) {
  const [advanced, setAdvanced] = useState(false),
    [draft, setDraft] = useState(filters.keyword);
  useEffect(() => setDraft(filters.keyword), [filters.keyword]);
  useEffect(() => {
    if (draft === filters.keyword) return;
    const timer = setTimeout(
      () => onSearch({ ...filters, keyword: draft }),
      350,
    );
    return () => clearTimeout(timer);
  }, [draft, filters, onSearch]);
  const active = Object.entries(filters).some(([key,value])=>key!=="uploadId" && Boolean(value));
  const update = (value: Partial<SearchFilters>) =>
    onSearch({ ...filters, keyword: draft, ...value });
  return (
    <div className="search-controls">
      <form
        className="search-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          update({});
        }}
      >
        <div className="search-field">
          <Search size={18} />
          <Input
            aria-label="Buscar arquivos"
            placeholder="Busque por nome, palavra ou conteúdo..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span className="search-hint">↵</span>
        </div>
        <Button
          variant="outline"
          type="button"
          className={advanced ? "filter-trigger selected" : "filter-trigger"}
          aria-expanded={advanced}
          aria-controls="advanced-filters"
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal size={16} />
          <span>Filtros</span>
        </Button>
      </form>
      <div className="type-filter-row">
        <div className="type-filters">
          {types.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={
                filters.fileType === value ? "type-chip selected" : "type-chip"
              }
              onClick={() => update({ fileType: value })}
              aria-pressed={filters.fileType === value}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        {active && (
          <button
            className="clear-filters"
            onClick={() => {
              setDraft("");
              onSearch({...emptyFilters, uploadId: filters.uploadId});
            }}
          >
            <X size={13} /> Limpar filtros
          </button>
        )}
      </div>
      {filters.transcriptionStatus && (
        <div className="flex items-center gap-2 text-xs text-amber-300">
          Exibindo transcrições pendentes
          <button
            aria-label="Remover filtro de transcrição"
            onClick={() => update({ transcriptionStatus: null })}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {advanced && (
        <div id="advanced-filters" className="advanced-filters">
          {(["dateFrom", "dateTo", "timeFrom", "timeTo"] as const).map(
            (key, index) => (
              <label key={key}>
                <span>
                  {
                    [
                      "Data inicial",
                      "Data final",
                      "Hora inicial",
                      "Hora final",
                    ][index]
                  }
                </span>
                <Input
                  type={index < 2 ? "date" : "time"}
                  value={filters[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                />
              </label>
            ),
          )}
        </div>
      )}
      {filters.uploadId && onDeleteUpload && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => onDeleteUpload(filters.uploadId!)}
        >
          <Trash2 size={14} /> Excluir este upload
        </Button>
      )}
    </div>
  );
}
