"use client";
import {
  Layers3,
  FileText,
  AudioLines,
  ImageIcon,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
interface Stats {
  totalUploads: number;
  totalFiles: number;
  textFiles: number;
  audioFiles: number;
  imageFiles: number;
  pendingTranscriptions: number;
}
interface Props {
  stats?: Stats;
  onCardClick?: (
    target: {
      type?: "text" | "audio" | "image" | "other";
      transcriptionStatus?: string;
    } | null,
  ) => void;
}
export function StatsCards({ stats, onCardClick }: Props) {
  const cards = [
    {
      label: "Todos os arquivos",
      value: stats?.totalFiles,
      detail: stats ? stats.totalUploads + " uploads no total" : "",
      icon: Layers3,
      tone: "cyan",
      target: null,
    },
    {
      label: "Textos e PDFs",
      value: stats?.textFiles,
      detail: "Conteúdo para descobrir",
      icon: FileText,
      tone: "lime",
      target: { type: "text" as const },
    },
    {
      label: "Arquivos de áudio",
      value: stats?.audioFiles,
      detail: "Uma nova forma de ouvir",
      icon: AudioLines,
      tone: "purple",
      target: { type: "audio" as const },
    },
    {
      label: "Imagens",
      value: stats?.imageFiles,
      detail: "Cada detalhe importa",
      icon: ImageIcon,
      tone: "pink",
      target: { type: "image" as const },
    },
    {
      label: "Áudios pendentes",
      value: stats?.pendingTranscriptions,
      detail: "Aguardando transcrição",
      icon: Clock3,
      tone: "amber",
      target: { type: "audio" as const, transcriptionStatus: "pending" },
    },
  ];
  return (
    <section className="stats-grid" aria-label="Resumo do workspace">
      {cards.map(({ icon: Icon, ...card }) => (
        <button
          key={card.label}
          className={"stat-card " + card.tone}
          onClick={() => onCardClick?.(card.target)}
          aria-label={"Filtrar: " + card.label}
        >
          <div className="stat-top">
            <span className="stat-icon">
              <Icon size={17} />
            </span>
            <ArrowUpRight className="stat-arrow" size={15} />
          </div>
          {card.value === undefined ? (
            <span className="skeleton stat-skeleton" aria-label="Carregando" />
          ) : (
            <strong className="stat-number">
              {new Intl.NumberFormat("pt-BR").format(card.value)}
            </strong>
          )}
          <span className="stat-label">{card.label}</span>
          <span className="stat-detail">
            {card.detail || "Carregando seu workspace"}
          </span>
        </button>
      ))}
    </section>
  );
}
