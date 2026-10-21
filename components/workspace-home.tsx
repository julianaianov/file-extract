"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import useSWR, { mutate } from "swr";
import {
  Archive,
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  CircleHelp,
  Command,
  FileSearch,
  FolderOpen,
  Layers3,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { UploadLibrary, type LibraryUpload } from "@/components/upload-library";
import { AccountPanel } from "@/components/account-panel";
import { FirstVisitGuide } from "@/components/first-visit-guide";
import { FileUpload } from "@/components/file-upload";
import {
  SearchFilters,
  emptyFilters,
  type SearchFilters as Filters,
} from "@/components/search-filters";
import { FileList } from "@/components/file-list";
import { StatsCards } from "@/components/stats-cards";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ExtractedFile } from "@/lib/db";

const ContextSearch = dynamic(
  () => import("@/components/context-search").then((m) => m.ContextSearch),
  { loading: () => <div className="skeleton h-44 rounded-2xl" /> },
);
const fetcher = async (url: string) => {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível carregar os dados.");
  return result;
};
interface Stats {
  totalUploads: number;
  totalFiles: number;
  textFiles: number;
  audioFiles: number;
  imageFiles: number;
  pendingTranscriptions: number;
}
export default function Home() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [tab, setTab] = useState<"files" | "context">("files");
  const [transcribingIds, setTranscribingIds] = useState<number[]>([]);
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const filesUrl = filters.uploadId ? "/api/files?" + params : null;
  const {data: uploads, error: uploadsError, isLoading: uploadsLoading} = useSWR<LibraryUpload[]>("/api/files?action=uploads", fetcher);
  const selectedUpload = uploads?.find(u=>u.id===filters.uploadId);
  const {
    data: filesData,
    error: filesError,
    isLoading: filesLoading,
    isValidating,
    mutate: refreshFiles,
  } = useSWR<{ files: ExtractedFile[] }>(filesUrl, fetcher, {
    keepPreviousData: false,
    dedupingInterval: 10000,
    refreshInterval: transcribingIds.length ? 5000 : 0,
  });
  const {
    data: stats,
    error: statsError,
    mutate: refreshStats,
  } = useSWR<Stats>("/api/files?action=stats", fetcher, {
    dedupingInterval: 15000,
  });
  const { data: capabilities } = useSWR<{ hasOpenAIKey: boolean }>(
    "/api/debug-env",
    fetcher,
    { dedupingInterval: 60000 },
  );
  const refresh = useCallback(() => {
    void refreshFiles();
    void refreshStats();
    void mutate("/api/files?action=uploads");
  }, [refreshFiles, refreshStats]);
  const scrollTo = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  const transcribe = async (fileId: number) => {
    setTranscribingIds((ids) => [...ids, fileId]);
    try {
      const r = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Não foi possível transcrever.");
      toast.success("Áudio transcrito com sucesso.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na transcrição.");
    } finally {
      setTranscribingIds((ids) => ids.filter((id) => id !== fileId));
    }
  };
  const connected = !!stats && !statsError;
  return (
    <main className="app-shell">
      <aside className="workspace-sidebar" aria-label="Navegação principal">
        <a href="/" className="brand-mark" aria-label="File Extract início">
          <Layers3 size={25} />
        </a>
        <div className="sidebar-navigation">
          <button
            className="sidebar-item active"
            title="Visão geral"
            aria-label="Visão geral"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <LayoutDashboard size={21} />
          </button>
          <button
            className="sidebar-item"
            title="Enviar arquivo"
            aria-label="Enviar arquivo"
            onClick={() => scrollTo("upload")}
          >
            <Upload size={21} />
          </button>
          <button
            className="sidebar-item"
            title="Biblioteca"
            aria-label="Biblioteca"
            onClick={() => {
              setTab("files");
              scrollTo("library");
            }}
          >
            <FolderOpen size={21} />
          </button>
          <button
            className="sidebar-item"
            title="Busca de contexto"
            aria-label="Busca de contexto"
            onClick={() => {
              setTab("context");
              scrollTo("library");
            }}
          >
            <ScanText size={21} />
          </button>
        </div>
        <a
          href="#help"
          className="sidebar-item mt-auto"
          aria-label="Como funciona"
          title="Como funciona"
        >
          <CircleHelp size={21} />
        </a>
        <div className="sidebar-avatar" title="Seu workspace">
          FE
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-cyan-300">
              <Layers3 size={20} />
            </span>{" "}
            file<span className="text-muted-foreground">extract</span>
            <span className="version-pill">2.0</span>
          </a>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            Workspace <ChevronRight size={12} />{" "}
            <span className="text-foreground">Visão geral</span>
          </div>
          <div className="flex items-center gap-3">
            <AccountPanel />
            <FirstVisitGuide />
            <span
              className={`connection-badge ${statsError ? "connection-error" : ""}`}
            >
              <span
                className={connected ? "status-dot" : "status-dot pending"}
              />
              {statsError
                ? "Sem conexão"
                : connected
                  ? "Conectado"
                  : "Conectando"}
            </span>
            <button
              className="icon-control"
              title="Atualizar arquivos"
              aria-label="Atualizar arquivos"
              onClick={refresh}
              disabled={isValidating}
            >
              <RefreshCw
                size={16}
                className={isValidating ? "animate-spin" : ""}
              />
            </button>
          </div>
        </header>
        <div className="dashboard-content">
          <section className="hero-section">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" /> ORGANIZE. EXTRAIA. DESCUBRA.
              </div>
              <h1>
                Seus arquivos, organizados.
                <br />
                <span className="hero-highlight">Encontre o conteúdo.</span>
              </h1>
              <p>
                Guarde qualquer formato e explore o conteúdo disponível.
                <br className="hidden sm:block" /> Envie, explore e encontre o
                que realmente importa.
              </p>
              <button className="hero-link" onClick={() => scrollTo("upload")}>
                Comece com um arquivo <ArrowDown size={15} />
              </button>
            </div>
            <div className="hero-orbit" aria-hidden="true">
              <div className="orbit-ring orbit-one" />
              <div className="orbit-ring orbit-two" />
              <div className="orbit-center">
                <Layers3 size={40} />
              </div>
              <div className="floating-document doc-pdf">
                <span className="doc-icon">
                  <FileSearch size={19} />
                </span>
                <div>
                  <b>documento.pdf</b>
                  <small>Conteúdo extraído</small>
                </div>
                <span className="mini-check">✓</span>
              </div>
              <div className="floating-document doc-zip">
                <span className="doc-icon">
                  <Archive size={20} />
                </span>
                <div>
                  <b>projeto.zip</b>
                  <small>Pronto para explorar</small>
                </div>
                <Sparkles size={15} />
              </div>
              <span className="orbit-star star-one" />
              <span className="orbit-star star-two" />
              <span className="orbit-star star-three" />
            </div>
          </section>
          <StatsCards
            stats={stats}
            onCardClick={(target) => {
              setFilters({
                ...emptyFilters,
                uploadId: filters.uploadId,
                fileType: target?.type || "",
                transcriptionStatus: target?.transcriptionStatus || null,
              });
              setTab("files");
              scrollTo("library");
            }}
          />
          <div className="upload-layout">
            <section id="upload" className="surface upload-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">01 / IMPORTAR</span>
                  <h2>
                    Um novo ponto de partida
                    <span className="text-cyan-300">.</span>
                  </h2>
                </div>
                <span className="soft-tag">
                  <Zap size={12} /> Extração automática
                </span>
              </div>
              <FileUpload
                onUploadComplete={({uploadId}) => {
                  setFilters({...emptyFilters,uploadId});
                  setTab("files");
                  refresh();
                  toast.success("Seu arquivo já está na biblioteca.");
                }}
              />
            </section>
            <aside className="surface workflow-panel" id="help">
              <span className="section-kicker">DO ARQUIVO À INFORMAÇÃO</span>
              <h2>
                Simples por fora.
                <br />
                <span className="text-muted-foreground">
                  Poderoso por dentro.
                </span>
              </h2>
              <div className="workflow-step">
                <span className="step-icon cyan">
                  <Upload size={18} />
                </span>
                <div>
                  <h3>Envie seu arquivo</h3>
                  <p>Qualquer formato, direto do seu dispositivo.</p>
                </div>
                <span className="step-number">01</span>
              </div>
              <div className="workflow-step">
                <span className="step-icon purple">
                  <ScanText size={18} />
                </span>
                <div>
                  <h3>Extraia possibilidades</h3>
                  <p>Texto de PDFs e arquivos organizados.</p>
                </div>
                <span className="step-number">02</span>
              </div>
              <div className="workflow-step">
                <span className="step-icon lime">
                  <FileSearch size={18} />
                </span>
                <div>
                  <h3>Encontre o que precisa</h3>
                  <p>Pesquise, visualize e baixe em um lugar.</p>
                </div>
                <span className="step-number">03</span>
              </div>
              <div className="workflow-footer">
                <ShieldCheck size={15} />
                <span>Seus arquivos disponíveis no seu workspace.</span>
              </div>
            </aside>
          </div>
          <section id="library" className="surface library-panel">
            <div className="panel-heading library-heading">
              <div>
                <span className="section-kicker">02 / EXPLORAR</span>
                <h2>
                  Sua biblioteca<span className="text-lime-300">.</span>
                </h2>
              </div>
              <span className="soft-tag">
                {stats?.totalFiles ?? "—"} arquivos no workspace
              </span>
            </div>
            {filters.uploadId ? <>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4"><Button variant="outline" onClick={()=>setFilters(emptyFilters)}>← Todos os envios</Button><strong className="min-w-0 break-all text-cyan-200">{selectedUpload?.original_name || "Envio selecionado"}</strong><span className="text-xs text-muted-foreground">Mostrando somente este envio</span></div>
            <div
              className="library-tabs"
              role="tablist"
              aria-label="Modo de exploração"
            >
              <button
                id="files-tab"
                role="tab"
                aria-selected={tab === "files"}
                aria-controls="files-panel"
                className={tab === "files" ? "selected" : ""}
                onClick={() => setTab("files")}
              >
                <FolderOpen size={16} /> Arquivos{" "}
                <span>{filesData?.files.length ?? 0}</span>
              </button>
              <button
                id="context-tab"
                role="tab"
                aria-selected={tab === "context"}
                aria-controls="context-panel"
                className={tab === "context" ? "selected" : ""}
                onClick={() => setTab("context")}
              >
                <ScanText size={16} /> Busca de contexto
              </button>
            </div>
            {tab === "files" ? (
              <div
                role="tabpanel"
                id="files-panel"
                aria-labelledby="files-tab"
                className="library-body"
              >
                <SearchFilters filters={filters} onSearch={setFilters} />
                {filesError ? (
                  <div className="error-panel" role="alert">
                    <h3>Não foi possível carregar sua biblioteca</h3>
                    <p>{filesError.message}</p>
                    <Button
                      variant="outline"
                      onClick={() => void refreshFiles()}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <div
                    className={
                      isValidating && !filesLoading ? "results-refreshing" : ""
                    }
                    aria-busy={isValidating}
                  >
                    <FileList
                      files={(filesData?.files || []).filter(f=>f.upload_id===filters.uploadId)}
                      isLoading={filesLoading}
                      onTranscribe={transcribe}
                      transcribingIds={transcribingIds}
                      transcriptionEnabled={!!capabilities?.hasOpenAIKey}
                      onChanged={refresh}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                role="tabpanel"
                id="context-panel"
                aria-labelledby="context-tab"
                className="library-body"
              >
                <ContextSearch key={filters.uploadId} uploadId={filters.uploadId} />
              </div>
            )}
            </> : uploadsError ? <div role="alert" className="error-panel"><p>Não foi possível carregar os envios.</p><Button onClick={refresh}>Tentar novamente</Button></div> : <UploadLibrary uploads={uploads || []} loading={uploadsLoading} onSelect={uploadId=>{setFilters({...emptyFilters,uploadId});setTab("files")}}/>}
          </section>
          <footer className="workspace-footer">
            <span className="flex items-center gap-2">
              <Layers3 size={14} /> fileextract{" "}
              <span className="text-muted-foreground/50">/</span> Dê sentido aos
              seus arquivos.
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} /> Seu conteúdo, organizado.
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}
