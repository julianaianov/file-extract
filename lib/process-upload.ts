import { reserveExtraction, attachExtraction, completeExtraction, refundExtraction, BillingError } from "./billing";
import { NextResponse } from "next/server";
import {
  createUpload,
  updateUploadStatus,
  createExtractedFile,
  updateFileMetadata,
  deleteUpload,
  type ExtractedFile,
} from "@/lib/db";
import { saveStoredFile, saveSessionFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/pdf";
import AdmZip from "adm-zip";
import path from "path";
import { randomUUID } from "crypto";



import { automaticParseAvailable, validFileSize } from "./upload-capacity";
const MAX_EXTRACTED_BYTES = 250 * 1024 * 1024;
function fileInfo(name: string): {
  type: ExtractedFile["file_type"];
  mime: string;
} {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") return { type: "text", mime: "application/pdf" };
  if (
    [
      ".txt",
      ".md",
      ".json",
      ".csv",
      ".xml",
      ".html",
      ".log",
      ".js",
      ".ts",
      ".css",
      ".py",
      ".sql",
      ".yaml",
      ".yml",
    ].includes(ext)
  )
    return { type: "text", mime: "text/plain" };
  const audio: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".webm": "audio/webm",
  };
  const image: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
  };
  if (audio[ext]) return { type: "audio", mime: audio[ext] };
  if (image[ext]) return { type: "image", mime: image[ext] };
  return { type: "other", mime: "application/octet-stream" };
}
export function processingBytes(filename:string, size:number) {
 const ext=path.extname(filename).toLowerCase();
 return ext===".zip" || ext===".pdf" ? (automaticParseAvailable(filename,size) ? size : Math.min(size,1024)) : fileInfo(filename).type==="text" ? Math.min(size,4000000) : 0;
}
export async function processUpload(request: Request) {
 const form = await request.formData(), file = form.get("file");
 if (!(file instanceof File)) return NextResponse.json({error:"Nenhum arquivo enviado"},{status:400});
 if (!validFileSize(file.size) || file.size > 4 * 1024 * 1024) return NextResponse.json({error:"Use o envio em partes para arquivos acima de 4 MB"},{status:413});
 return processBuffer(Buffer.from(await file.arrayBuffer()), file.name, form.get("customName"));
}
export async function processBuffer(buffer: Buffer, filename: string, customName: unknown, sessionId?: string, sourceSize = buffer.length) {
 const file = {name: filename, size: sourceSize};
 if (!filename.trim() || filename.length>250 || filename.includes("\u0000")) return NextResponse.json({error:"Nome de arquivo inválido"},{status:400});
  let uploadId: number | undefined;
  let charge: string | null = null;
  try {
    const extension = path.extname(file.name).toLowerCase();
    if (!validFileSize(file.size))
      return NextResponse.json(
        { error: "Tamanho de arquivo inválido" },
        { status: 413 },
      );
    if (
      extension === ".pdf" &&
      !buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))
    )
      return NextResponse.json(
        { error: "O arquivo enviado não é um PDF válido." },
        { status: 422 },
      );
    let entries: ReturnType<AdmZip["getEntries"]> | null = null;
    const parseAvailable = automaticParseAvailable(file.name, file.size);
    if (extension === ".zip" && parseAvailable) {
      try {
        entries = new AdmZip(buffer)
          .getEntries()
          .filter(
            (e) =>
              !e.isDirectory &&
              !e.entryName.startsWith("__MACOSX") &&
              !e.entryName.includes(".DS_Store"),
          );
      } catch {
        return NextResponse.json(
          {
            error: "O ZIP está inválido ou incompleto. Envie uma cópia válida.",
          },
          { status: 422 },
        );
      }
      if (!entries.length) return NextResponse.json({ error: "O ZIP não contém arquivos processáveis." }, { status: 422 });
      if (
        entries.length > 1000 ||
        entries.reduce((n, e) => n + e.header.size, 0) > MAX_EXTRACTED_BYTES
      )
        return NextResponse.json(
          { error: "ZIP excede o limite de 1000 arquivos ou 250 MB extraídos" },
          { status: 413 },
        );
    }
    const uniqueId = randomUUID(),
      savedFilename = uniqueId + extension;
    charge = await reserveExtraction(file.size);
    uploadId = await createUpload(
      savedFilename,
      typeof customName === "string" && customName.trim()
        ? customName.trim()
        : file.name,
      file.size,
    );
    await attachExtraction(charge, uploadId);
    if(sessionId) await saveSessionFile("uploads/" + savedFilename, uploadId, sessionId);
    else await saveStoredFile("uploads/" + savedFilename, uploadId, buffer);
    const extracted = entries
      ? entries.map((entry, index) => ({
          name: path.posix.basename(entry.entryName.replaceAll("\\", "/")),
          key: uniqueId + "/" + index,
          data: () => entry.getData(),
        }))
      : [{ name: file.name, key: uniqueId + "/0", data: () => buffer }];
    const warnings: string[] = [];
    const capacityWarning = parseAvailable ? undefined : "Original salvo integralmente para download. A extração automática de PDF/ZIP acima de 250 MB não está disponível neste servidor; o conteúdo ainda não foi extraído.";
    let extractedBytes = 0;
    for (const entry of extracted) {
      const data = entry.data(),
        info = fileInfo(entry.name);
      extractedBytes += data.length;
      if (entries && extractedBytes > MAX_EXTRACTED_BYTES)
        throw new Error("Limite de descompactação excedido");
      let text: string | null = null,
        warning: string | undefined = capacityWarning,
        status: string | undefined;
      if (info.mime === "application/pdf" && parseAvailable) {
        const result = await extractPdfText(data);
        text = result.text;
        warning = result.warning;
        status = result.status;
      } else if (info.type === "text" && parseAvailable)
        text = data
          .subarray(0, 4000000).toString("utf8")
          .replace(/\u0000/g, "")
          .slice(0, 1000000);
      if(info.type === "text" && info.mime !== "application/pdf" && ((entries ? data.length : file.size) > 4000000 || (text?.length || 0) === 1000000)) warning = "A busca e a prévia incluem o primeiro milhão de caracteres. Baixe o original para acessar todo o conteúdo.";
      const key = entries ? "extracted/" + entry.key : "uploads/" + savedFilename;
      if (entries) await saveStoredFile(key, uploadId, data);
      const id = await createExtractedFile(
        uploadId,
        entry.name,
        key,
        info.type,
        entries ? data.length : file.size,
        info.mime,
        text,
        info.type === "audio" ? "pending" : "not_applicable",
      );
      if (warning) {
        warnings.push(entry.name + ": " + warning);
        await updateFileMetadata(id, {
          pdf_warning: warning,
          extraction_status: status,
        });
      }
    }
    await updateUploadStatus(uploadId, "completed", extracted.length);
    await completeExtraction(charge, uploadId);
    return NextResponse.json({
      success: true,
      uploadId,
      totalFiles: extracted.length,
      warnings,
      message: warnings.length
        ? "Arquivos salvos com avisos de extração."
        : "Arquivo processado com sucesso",
    });
  } catch (error) {
    await refundExtraction(charge).catch(() => {});
    if (error instanceof BillingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (uploadId) await deleteUpload(uploadId).catch(() => {});
    console.error("Falha ao processar upload:", {
      name: error instanceof Error ? error.name : "Error",
      code: (error as { code?: string })?.code,
      message:
        error instanceof Error
          ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[REDACTED]")
          : "Unknown",
    });
    return NextResponse.json(
      {
        error:
          "Não foi possível salvar o arquivo. Tente novamente em instantes.",
      },
      { status: 500 },
    );
  }
}
