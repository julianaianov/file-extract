'use client';

import { Upload, FileText, Mic, ImageIcon, Clock } from 'lucide-react';

interface Stats {
  totalUploads: number;
  totalFiles: number;
  textFiles: number;
  audioFiles: number;
  imageFiles: number;
  pendingTranscriptions: number;
}

interface StatsCardsProps {
  stats: Stats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: 'Total Uploads',
      value: stats.totalUploads,
      icon: Upload,
      color: 'text-blue-400',
    },
    {
      label: 'Arquivos de Texto',
      value: stats.textFiles,
      icon: FileText,
      color: 'text-green-400',
    },
    {
      label: 'Arquivos de Audio',
      value: stats.audioFiles,
      icon: Mic,
      color: 'text-yellow-400',
    },
    {
      label: 'Imagens',
      value: stats.imageFiles,
      icon: ImageIcon,
      color: 'text-pink-400',
    },
    {
      label: 'Transcricoes Pendentes',
      value: stats.pendingTranscriptions,
      icon: Clock,
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className={`rounded-lg bg-secondary p-3 ${card.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
