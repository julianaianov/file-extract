"use client";
import { useMemo, useState } from "react";
import { SearchExcerpts } from "./search-excerpts";
import dynamic from "next/dynamic";
import {
  Archive,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  Grid2X2,
  ImageIcon,
  List,
  Loader2,
  ScanText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ExtractedFile as StoredFile } from "@/lib/db";
type ExtractedFile = StoredFile & { upload_name?: string };
interface Props {
  files: ExtractedFile[];
  isLoading?: boolean;
  onTranscribe?: (id: number) => void | Promise<void>;
  transcribingIds?: number[];
  transcriptionEnabled?: boolean;
  onChanged?: () => void;
}
const FilePreview = dynamic(
  () => import("./file-preview").then((m) => m.FilePreview),
  { ssr: false },
);
const themes = {
  text: { icon: FileText, tone: "cyan" },
  audio: { icon: AudioLines, tone: "purple" },
  image: { icon: ImageIcon, tone: "pink" },
  other: { icon: File, tone: "amber" },
};
const dates = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const formatSize = (size: number) =>
  size < 1024
    ? size + " B"
    : size < 1048576
      ? (size / 1024).toFixed(1) + " KB"
      : (size / 1048576).toFixed(1) + " MB";
const labels = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Transcrito",
  error: "Tentar novamente",
  not_applicable: "",
};
export function FileList({
  files,
  isLoading,
  onTranscribe,
  transcribingIds = [],
  transcriptionEnabled = false,
  onChanged,
}: Props) {
  const [queueRunning, setQueueRunning] = useState(false);
  const [preview, setPreview] = useState<ExtractedFile | null>(null),
    [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<number[]>([]),
    [view, setView] = useState<"grid" | "list">("grid"),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState<number[]>([]);
  const selectedIds = useMemo(
    () => selected.filter((id) => files.some((f) => f.id === id)),
    [selected, files],
  );
  const audioQueue = files
    .filter(
      (f) =>
        f.file_type === "audio" &&
        f.transcription_status !== "completed" &&
        (!selecting || selectedIds.includes(f.id)),
    )
    .sort(
      (a, b) =>
        new Date(a.extracted_date).getTime() -
        new Date(b.extracted_date).getTime(),
    );
  const pages = Math.max(1, Math.ceil(files.length / 12)),
    current = Math.min(page, pages),
    visible = files.slice((current - 1) * 12, current * 12);
  const download = async (file: ExtractedFile) => {
    try {
      const r = await fetch("/api/files/" + file.id + "?action=download");
      if (!r.ok) throw Error("Não foi possível baixar o arquivo.");
      const url = URL.createObjectURL(await r.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no download.");
    }
  };
  const remove = async (ids: number[]) => {
    if (
      !window.confirm(
        ids.length === 1
          ? "Excluir este arquivo?"
          : "Excluir os " + ids.length + " arquivos selecionados?",
      )
    )
      return;
    setBusy(ids);
    try {
      let failed = 0;
      for (const id of ids) {
        const r = await fetch("/api/files/" + id, { method: "DELETE" });
        if (!r.ok) failed++;
      }
      if (failed)
        throw Error(failed + " arquivo(s) não puderam ser excluídos.");
      setSelected([]);
      toast.success(
        ids.length === 1 ? "Arquivo excluído." : "Arquivos excluídos.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setBusy([]);
      onChanged?.();
    }
  };
  const ocr = async (file: ExtractedFile) => {
    setBusy((ids) => [...ids, file.id]);
    try {
      const r = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: file.id }),
        }),
        data = await r.json();
      if (!r.ok) throw Error(data.error || "Não foi possível extrair o texto.");
      toast.success("Texto extraído da imagem.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no OCR.");
    } finally {
      setBusy((ids) => ids.filter((id) => id !== file.id));
    }
  };
  if (isLoading)
    return (
      <div className="file-grid" aria-label="Carregando arquivos" role="status">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton file-skeleton" />
        ))}
      </div>
    );
  if (!files.length)
    return (
      <div className="file-empty">
        <div className="empty-art" aria-hidden="true">
          <FolderOpen />
          <span className="empty-dot">
            <Sparkles size={13} />
          </span>
        </div>
        <h3>Um espaço para suas próximas descobertas</h3>
        <p>
          Envie um ZIP ou PDF para começar. Se já enviou, experimente ajustar os
          filtros.
        </p>
        <a href="#upload" className="empty-upload-link">
          Enviar meu primeiro arquivo <ArrowUpRight size={13} />
        </a>
      </div>
    );
  return (
    <>
      <div className="file-toolbar">
        <span className="file-count">
          {files.length} arquivo{files.length === 1 ? "" : "s"}
          {selectedIds.length
            ? " · " + selectedIds.length + " selecionados"
            : ""}
        </span>
        <div className="file-toolbar-actions">
          {transcriptionEnabled && audioQueue.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={queueRunning || !!transcribingIds.length}
              onClick={async () => {
                setQueueRunning(true);
                try {
                  for (const file of audioQueue) await onTranscribe?.(file.id);
                } finally {
                  setQueueRunning(false);
                }
              }}
            >
              {queueRunning ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <AudioLines size={13} />
              )}
              Transcrever {selecting ? "selecionados" : "pendentes"}
            </Button>
          )}
          {selecting && selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={!!busy.length}
              onClick={() => void remove(selectedIds)}
            >
              <Trash2 size={13} />
              <span>Excluir ({selectedIds.length})</span>
            </Button>
          )}
          <Button
            variant={selecting ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? "Concluir seleção" : "Selecionar"}
          </Button>
          <div
            className="view-toggle"
            role="group"
            aria-label="Visualização da biblioteca"
          >
            <button
              className={view === "grid" ? "selected" : ""}
              onClick={() => setView("grid")}
              aria-label="Visualização em grade"
              aria-pressed={view === "grid"}
            >
              <Grid2X2 size={13} />
            </button>
            <button
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
              aria-label="Visualização em lista"
              aria-pressed={view === "list"}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className={"file-grid " + (view === "list" ? "list-view" : "")}>
        {visible.map((file) => {
          const theme = themes[file.file_type],
            Icon = theme.icon,
            isBusy =
              busy.includes(file.id) || transcribingIds.includes(file.id);
          return (
            <article
              key={file.id}
              className={
                "file-card " +
                theme.tone +
                (selectedIds.includes(file.id) ? " is-selected" : "")
              }
            >
              <div className="file-card-top">
                <span className="file-symbol">
                  <Icon size={21} />
                </span>
                {selecting ? (
                  <input
                    type="checkbox"
                    aria-label={"Selecionar " + file.filename}
                    checked={selectedIds.includes(file.id)}
                    onChange={() =>
                      setSelected((ids) =>
                        ids.includes(file.id)
                          ? ids.filter((id) => id !== file.id)
                          : [...ids, file.id],
                      )
                    }
                    className="size-4 accent-lime-300"
                  />
                ) : (
                  <span className="file-extension">
                    {file.filename
                      .split(".")
                      .pop()
                      ?.slice(0, 7)
                      .toUpperCase() || "ARQUIVO"}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <button
                  className="file-card-title"
                  title={file.filename}
                  aria-label={"Abrir " + file.filename}
                  onClick={() => setPreview(file)}
                >
                  {file.filename}
                </button>
                {file.metadata?.includes('"pdf_warning"') && (
                  <span className="mt-1 block text-[10px] text-amber-300">
                    Original salvo · texto indisponível
                  </span>
                )}
                <div className="file-metadata">
                  <span>{formatSize(Number(file.file_size))}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={file.extracted_date}>
                    {dates.format(new Date(file.extracted_date))}
                  </time>
                  {file.file_type === "audio" && (
                    <span className="text-violet-300">
                      {labels[file.transcription_status]}
                    </span>
                  )}
                </div>
              </div>
              {file.file_type === "audio" && <div className="library-audio"><audio controls preload="none" aria-label={"Reproduzir " + file.filename} src={"/api/files/" + file.id + "?action=stream"} onPlay={event => { document.querySelectorAll("audio").forEach(audio => { if (audio !== event.currentTarget) audio.pause(); }); }} /><a href={"/api/files/" + file.id + "?action=download"} className="text-xs text-cyan-300 underline">Baixar original</a></div>}
              {file.search_keyword && <SearchExcerpts contexts={file.search_context ?? []} keyword={file.search_keyword} />}
              <div className="file-card-bottom">
                <span className="file-origin" title={file.upload_name}>
                  {file.upload_name || "Seu workspace"}
                </span>
                <div className="file-actions">
                  {isBusy ? (
                    <Loader2 size={15} className="animate-spin text-cyan-300" />
                  ) : (
                    <>
                      {file.file_type === "image" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void ocr(file)}
                          aria-label={"Extrair texto de " + file.filename}
                          title="Extrair texto da imagem"
                        >
                          <ScanText />
                        </Button>
                      )}
                      {file.file_type === "audio" &&
                        file.transcription_status !== "completed" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!transcriptionEnabled}
                            onClick={() => void onTranscribe?.(file.id)}
                            aria-label={"Transcrever " + file.filename}
                            title={
                              transcriptionEnabled
                                ? "Transcrever áudio"
                                : "Transcrição indisponível neste momento"
                            }
                          >
                            <AudioLines />
                          </Button>
                        )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPreview(file)}
                        aria-label={"Visualizar " + file.filename}
                        title="Visualizar"
                      >
                        <Eye />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void download(file)}
                        aria-label={"Baixar " + file.filename}
                        title="Baixar"
                      >
                        <Download />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="delete"
                        onClick={() => void remove([file.id])}
                        aria-label={"Excluir " + file.filename}
                        title="Excluir"
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {pages > 1 && (
        <nav className="file-pagination" aria-label="Paginação dos arquivos">
          <span>
            {(current - 1) * 12 + 1}–{Math.min(current * 12, files.length)} de{" "}
            {files.length} arquivos
          </span>
          <div className="pagination-controls">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
            </Button>
            <span>
              {current} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </nav>
      )}
      {preview && (
        <FilePreview file={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
