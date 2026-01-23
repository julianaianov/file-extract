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
      bg: 'bg-blue-500/10 border-blue-500/20',
      iconBg: 'bg-blue-500/20',
    },
    {
      label: 'Arquivos de Texto',
      value: stats.textFiles,
      icon: FileText,
      color: 'text-green-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
    },
    {
      label: 'Arquivos de Audio',
      value: stats.audioFiles,
      icon: Mic,
      color: 'text-yellow-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      iconBg: 'bg-amber-500/20',
    },
    {
      label: 'Imagens',
      value: stats.imageFiles,
      icon: ImageIcon,
      color: 'text-pink-400',
      bg: 'bg-fuchsia-500/10 border-fuchsia-500/20',
      iconBg: 'bg-fuchsia-500/20',
    },
    {
      label: 'Transcricoes Pendentes',
      value: stats.pendingTranscriptions,
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
      iconBg: 'bg-orange-500/20',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`flex items-center gap-4 rounded-lg border p-4 ${card.bg}`}
          >
            <div className={`rounded-lg p-3 ${card.iconBg} ${card.color}`}>
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
