"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, FileSearch, Headphones, Upload, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { highlight } from "./search-excerpts";
import { Button } from "@/components/ui/button";
const key = "file-extract:guide:v1";
const steps = [
  { title: "Seus arquivos, em poucos passos", text: "Envie um ZIP ou PDF de até 50 MB. Para importar áudios e imagens, coloque esses arquivos dentro de um ZIP.", icon: Upload },
  { title: "Explore sua biblioteca", text: "Depois da extração, os arquivos aparecem separados. Filtre por tipo, upload ou data. Abra pelo nome e use os ícones para visualizar ou baixar o original.", icon: Sparkles },
  { title: "Encontre a palavra e o contexto", text: "A busca procura no nome e no texto disponível. Você vê duas linhas acima e duas abaixo. Ao abrir o arquivo, o termo fica marcado. Experimente abaixo!", icon: FileSearch },
  { title: "Ouça, leia e descubra", text: "Nos áudios, aperte o play e ajuste o volume ou avance pela gravação. Nas imagens, use Extrair texto para fazer OCR. A transcrição de áudio depende de estar habilitada; ouvir não depende dela.", icon: Headphones },
];
export function FirstVisitGuide() {
  const [open, setOpen] = useState(false), [step, setStep] = useState(0), [demo, setDemo] = useState("projeto");
  useEffect(() => { try { if (!localStorage.getItem(key)) setOpen(true); } catch { setOpen(true); } }, []);
  const close = () => { try { localStorage.setItem(key, "seen"); } catch {} setOpen(false); };
  const current = steps[step], Icon = current.icon;
  return <>
    <button className="guide-launch" onClick={() => { setStep(0); setOpen(true); }} aria-label="Abrir tutorial"><CircleHelp size={16} /><span>Tutorial</span></button>
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="guide-dialog" overlayClassName="guide-overlay" style={{ backgroundColor: "#101722", backgroundImage: "none", color: "#eaf1fb", zIndex: 101 }}>
        <div className="guide-eyebrow">BEM-VINDO AO FILE EXTRACT</div>
        <div className="guide-progress" aria-label="Etapas do tutorial">{steps.map((item, index) => <button key={item.title} onClick={() => setStep(index)} aria-label={"Etapa " + (index + 1)} aria-current={step === index ? "step" : undefined} className={index <= step ? "active" : ""}>{index < step ? <Check size={14} /> : index + 1}</button>)}</div>
        <div className="guide-body" key={step}>
          <div className="guide-symbol"><Icon size={30} /></div>
          <DialogTitle className="text-xl sm:text-2xl">{current.title}</DialogTitle>
          <DialogDescription className="guide-description">{current.text}</DialogDescription>
          {step === 0 && <div className="guide-demo"><Upload size={28} /><strong>seus-arquivos.zip ou documento.pdf</strong><span>Escolha o arquivo → clique em Extrair arquivo → abra a biblioteca</span></div>}
          {step === 1 && <div className="guide-demo"><span className="guide-chips">Texto e PDF · Áudio · Imagens</span><strong>Uma biblioteca, vários formatos</strong><span>Visualize o conteúdo ou baixe o original quando precisar.</span></div>}
          {step === 2 && <div className="guide-demo"><label className="w-full text-left text-xs">Experimente buscar<input aria-label="Experimentar busca no tutorial" className="guide-input" value={demo} onChange={e => setDemo(e.target.value)} placeholder="Digite projeto" /></label><p className="w-full text-left">Reunião de planejamento<br />Equipe reunida hoje<br />{highlight("O projeto come\u00e7a amanh\u00e3.", demo)}<br />Responsáveis definidos<br />Próxima revisão na sexta</p></div>}
          {step === 3 && <div className="guide-demo"><Headphones size={30} /><strong>Play direto na biblioteca</strong><span>Use a barra do reprodutor para pausar, avançar e controlar o volume. Se o formato não tocar no navegador, baixe o original.</span></div>}
        </div>
        <div className="guide-footer"><Button variant="ghost" onClick={close}>Pular tutorial</Button><div className="flex gap-2">{step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} aria-label="Etapa anterior"><ArrowLeft size={15} /></Button>}<Button onClick={() => step === steps.length - 1 ? close() : setStep(step + 1)}>{step === steps.length - 1 ? "Começar a usar" : "Próximo"}<ArrowRight size={15} /></Button></div></div>
        <p className="text-center text-xs text-muted-foreground">Você pode rever este guia pelo botão Tutorial.</p>
      </DialogContent>
    </Dialog>
  </>;
}
