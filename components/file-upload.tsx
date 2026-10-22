"use client";

import { uploadInParts } from "@/lib/upload-parts";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CloudUpload,
  FileText,
  Archive,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
interface Props {
  onUploadComplete?: (result: { uploadId: number; totalFiles: number }) => void;
}
import { automaticParseAvailable } from "@/lib/upload-capacity";
export function FileUpload({ onUploadComplete }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [quoteError,setQuoteError]=useState("");
  const [quote,setQuote]=useState<{free:boolean;admin:boolean;cost:number|null}|null>(null);
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState(""),
    [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<
      "idle" | "uploading" | "processing" | "success" | "error"
    >("idle"),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const busy = phase === "uploading" || phase === "processing";
  useEffect(()=>{setQuote(null);setQuoteError("");if(!file)return;const controller=new AbortController();fetch("/api/billing?size="+file.size,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(a=>setQuote({free:!a.enabled||a.freeAvailable,admin:!!a.isAdmin,cost:a.tokenCost})).catch(()=>{if(!controller.signal.aborted)setQuoteError("Não foi possível consultar o custo. Selecione o arquivo novamente.");});return()=>controller.abort();},[file]);
  const select = (candidate?: File) => {
    if (!candidate) return;
    setQuote(null);
    setWarnings([]);
    if (!Number.isSafeInteger(candidate.size) || !candidate.size) {
      setFile(null);
      setMessage("Escolha um arquivo com tamanho válido.");
      setPhase("error");
      return;
    }
    setFile(candidate);
    setMessage("");
    setPhase("idle");
    setName("");
  };
  const reset = () => {
    setWarnings([]);
    setFile(null);
    setName("");
    setPhase("idle");
    setMessage("");
    if (input.current) input.current.value = "";
  };
  const send = async () => {
    if (!file || busy) return;
    setWarnings([]);
    setPhase("uploading");
    setProgress(0);
    setMessage("");
    try {
      const accountResponse = await fetch("/api/billing?size="+file.size);
      if (!accountResponse.ok) throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
      const account = await accountResponse.json();
      if (account.enabled && !account.isAdmin && !account.freeAvailable && (!account.loggedIn || !account.tokenCost || account.tokens < account.tokenCost)) { window.dispatchEvent(new Event("billing-required")); throw new Error("Entre na sua conta e escolha uma assinatura ou tokens para continuar."); }
      const result = file.size > 4 * 1024 * 1024 ? await uploadInParts(file, name.trim(), percent => { setProgress(percent); if (percent === 100) setPhase("processing"); }) : await new Promise<{
        uploadId: number;
        totalFiles: number;
        warnings?: string[];
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest(),
          body = new FormData();
        body.append("file", file);
        if (name.trim()) body.append("customName", name.trim());
        xhr.open("POST", "/api/upload");
        xhr.timeout = 65000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setProgress(percent);
            if (percent === 100) setPhase("processing");
          }
        };
        xhr.onload = () => {
          let data;
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            reject(
              new Error(
                xhr.status === 413
                  ? "O envio direto excedeu a capacidade. Use o envio em partes."
                  : "Não foi possível processar o arquivo. Tente novamente.",
              ),
            );
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else { if ([401,402].includes(xhr.status)) window.dispatchEvent(new Event("billing-required")); reject(new Error(data.error || "Falha ao processar o arquivo.")); }
        };
        xhr.onerror = () =>
          reject(
            new Error("Sem conexão. Confira sua internet e tente novamente."),
          );
        xhr.ontimeout = () =>
          reject(
            new Error(
              "O processamento demorou demais. Tente um arquivo menor.",
            ),
          );
        xhr.send(body);
      });
      window.dispatchEvent(new Event("billing-updated"));
      setWarnings(result.warnings || []);
      setPhase("success");
      setMessage(
        result.warnings?.length
          ? result.totalFiles +
              " arquivo(s) salvo(s). Confira os avisos abaixo."
          : result.totalFiles +
              " arquivo" +
              (result.totalFiles === 1 ? "" : "s") +
              " na sua biblioteca.",
      );
      setFile(null);
      setName("");
      if (input.current) input.current.value = "";
      onUploadComplete?.(result);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível enviar.");
      setPhase("error");
    }
  };
  return (
    <div className="upload-widget">
      <label
        className={`dropzone ${dragging ? "dragging" : ""} ${busy ? "processing" : ""} ${phase === "success" ? "completed" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) select(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={input}
          type="file"
          className="sr-only"
          aria-label="Selecionar arquivo"
          disabled={busy}
          onChange={(e) => select(e.target.files?.[0])}
        />
        <div className="dropzone-grid" aria-hidden="true" />
        <span className="upload-symbol">
          {busy ? (
            <Loader2 className="animate-spin" size={31} />
          ) : phase === "success" ? (
            <Check size={31} />
          ) : file ? (
            !file.name.toLowerCase().endsWith(".zip") ? (
              <FileText size={31} />
            ) : (
              <Archive size={31} />
            )
          ) : (
            <CloudUpload size={33} />
          )}
        </span>
        <strong>
          {busy
            ? phase === "processing"
              ? "Extraindo possibilidades..."
              : "Enviando seu arquivo..."
            : file
              ? file.name
              : dragging
                ? "Solte aqui. A gente cuida do resto."
                : "Arraste seu próximo projeto para cá"}
        </strong>
        <span className="dropzone-subtitle">
          {busy ? (
            "Seu conteúdo está a caminho da biblioteca."
          ) : file ? (
            (file.size / 1024 / 1024).toFixed(2) + (automaticParseAvailable(file.name,file.size) ? " MB · pronto para extrair" : " MB · original para download")
          ) : (
            <>
              ou{" "}
              <span className="text-cyan-300 underline underline-offset-4">
                escolha um arquivo
              </span>{" "}
              no seu dispositivo
            </>
          )}
        </span>
        {!busy && !file && (
          <div className="format-tags">
            <span>
              <Archive size={12} /> ZIP
            </span>
            <span>
              <FileText size={12} /> PDF
            </span>
            <span className="format-limit">Todos os formatos · envio em partes · capacidade conforme armazenamento</span>
          </div>
        )}
        {busy && (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="progress-label">
              <span>
                {phase === "processing"
                  ? "Processando conteúdo"
                  : "Transferindo arquivo"}
              </span>
              <span>
                {phase === "processing" ? (
                  <Sparkles size={13} />
                ) : (
                  progress + "%"
                )}
              </span>
            </div>
            <div
              className={
                "progress-track " +
                (phase === "processing" ? "indeterminate" : "")
              }
            >
              <span style={{ width: progress + "%" }} />
            </div>
          </div>
        )}
      </label>
      {file && !busy && (
        <div className="selected-upload flex-wrap">
          <div className="w-full basis-full space-y-2 text-sm" aria-live="polite">
            <p>{quote ? quote.admin ? "Administrador: sem cobrança." : quote.free ? "Seu primeiro documento é gratuito." : quote.cost ? "Este envio utiliza " + quote.cost + " token(s), descontados ao concluir. O custo considera blocos de 250 MB." : "Não foi possível calcular o custo deste envio." : quoteError || "Consultando o custo do envio..."}</p>
            {!automaticParseAvailable(file.name,file.size) && <p className="text-amber-200">O original será salvo integralmente para download. A extração automática de PDF/ZIP acima de 250 MB ainda não está disponível; o conteúdo não será extraído.</p>}
          </div>
          <label className="upload-name">
            Como quer chamar este upload?
            <input
              placeholder={file.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={send} disabled={!quote || (!quote.free && !quote.admin && !quote.cost)} className="upload-submit">
              {automaticParseAvailable(file.name,file.size) ? "Extrair arquivo" : "Salvar original"} <ArrowUpRight size={17} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={reset}
              aria-label="Remover arquivo selecionado"
            >
              <X size={18} />
            </Button>
          </div>
        </div>
      )}
      {message && (
        <div
          role={phase === "error" ? "alert" : "status"}
          className={
            "upload-feedback " + (phase === "error" ? "error" : "success")
          }
        >
          {phase === "success" && <Check size={16} />}
          <span>{message}</span>
        </div>
      )}
      {warnings.length > 0 && (
        <div
          role="status"
          className="mt-3 space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200"
        >
          {warnings.slice(0, 3).map((warning) => (
            <p key={warning} className="break-words">
              {warning}
            </p>
          ))}
          {warnings.length > 3 && (
            <p>
              Mais {warnings.length - 3} avisos; consulte os arquivos na
              biblioteca.
            </p>
          )}
        </div>
      )}
      <div className="upload-note">
        <ShieldCheck size={13} />
        <span>
          Qualquer formato. ZIPs descompactados; texto, áudio e imagens com recursos próprios.
        </span>
      </div>
    </div>
  );
}
