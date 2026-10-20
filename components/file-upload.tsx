"use client";

import { useRef, useState } from "react";
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
const maxBytes = 4 * 1024 * 1024;
export function FileUpload({ onUploadComplete }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState(""),
    [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<
      "idle" | "uploading" | "processing" | "success" | "error"
    >("idle"),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState("");
  const busy = phase === "uploading" || phase === "processing";
  const select = (candidate?: File) => {
    if (!candidate) return;
    if (!/\.(zip|pdf)$/i.test(candidate.name)) {
      setFile(null);
      setMessage("Escolha um arquivo ZIP ou PDF.");
      setPhase("error");
      return;
    }
    if (!candidate.size || candidate.size > maxBytes) {
      setFile(null);
      setMessage("Escolha um arquivo de até 4 MB.");
      setPhase("error");
      return;
    }
    setFile(candidate);
    setMessage("");
    setPhase("idle");
    setName("");
  };
  const reset = () => {
    setFile(null);
    setName("");
    setPhase("idle");
    setMessage("");
    if (input.current) input.current.value = "";
  };
  const send = async () => {
    if (!file || busy) return;
    setPhase("uploading");
    setProgress(0);
    setMessage("");
    try {
      const result = await new Promise<{
        uploadId: number;
        totalFiles: number;
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
                  ? "O arquivo excede o limite de envio. Use um arquivo de até 4 MB."
                  : "Não foi possível processar o arquivo. Tente novamente.",
              ),
            );
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || "Falha ao processar o arquivo."));
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
      setPhase("success");
      setMessage(
        result.totalFiles +
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
          accept=".zip,.pdf"
          className="sr-only"
          aria-label="Selecionar arquivo ZIP ou PDF"
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
            file.name.toLowerCase().endsWith(".pdf") ? (
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
            (file.size / 1024 / 1024).toFixed(2) + " MB · pronto para extrair"
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
            <span className="format-limit">até 4 MB</span>
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
        <div className="selected-upload">
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
            <Button onClick={send} className="upload-submit">
              Extrair arquivo <ArrowUpRight size={17} />
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
      <div className="upload-note">
        <ShieldCheck size={13} />
        <span>
          ZIPs organizados. PDFs com texto pesquisável. Tudo em um lugar.
        </span>
      </div>
    </div>
  );
}
