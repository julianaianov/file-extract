import { NextResponse } from "next/server";
import {
  getExtractedFile,
  getExtractedFilesByUpload,
  getUpload,
  deleteUpload,
  deleteExtractedFile,
} from "@/lib/db";
import { readStoredFile, deleteStoredFile } from "@/lib/storage";
export const runtime = "nodejs";
function pdfWarning(metadata: string | null): string | undefined {
  try {
    const value = JSON.parse(metadata || "{}").pdf_warning;
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const id = Number((await context.params).id),
      action = new URL(request.url).searchParams.get("action");
    if (!Number.isSafeInteger(id) || id < 1)
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    if (action === "upload-files")
      return NextResponse.json(await getExtractedFilesByUpload(id));
    const file = await getExtractedFile(id);
    if (file) {
      if (action === "stream") {
        if (file.file_type !== "audio") return NextResponse.json({ error: "Arquivo sem audio" }, { status: 415 });
        const buffer = await readStoredFile(file.file_path);
        const headers: Record<string, string> = { "Content-Type": file.mime_type || "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
        const range = request.headers.get("range");
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          let start = 0, end = buffer.length - 1;
          if (match) {
            if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
            else if (match[2]) start = Math.max(0, buffer.length - Number(match[2]));
          }
          if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= buffer.length || (!match[1] && Number(match[2]) === 0)) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": "bytes */" + buffer.length } });
          return new Response(new Uint8Array(buffer.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": "bytes " + start + "-" + end + "/" + buffer.length, "Content-Length": String(end - start + 1) } });
        }
        return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Length": String(buffer.length) } });
      }
      if (action === "download") {
        const buffer = await readStoredFile(file.file_path);
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": file.mime_type || "application/octet-stream",
            "Content-Disposition":
              "attachment; filename*=UTF-8''" +
              encodeURIComponent(file.filename),
            "Content-Length": String(buffer.length),
          },
        });
      }
      if (action === "content") {
        if (file.file_type === "text")
          return NextResponse.json({
            type: "text",
            content: file.content_text || "",
            warning: pdfWarning(file.metadata),
          });
        if (file.file_type === "image" || file.file_type === "audio") {
          const buffer = await readStoredFile(file.file_path),
            mimeType = file.mime_type || "application/octet-stream";
          return NextResponse.json({
            type: file.file_type,
            mimeType,
            data: "data:" + mimeType + ";base64," + buffer.toString("base64"),
            ocrText: file.content_text || "",
            transcription: file.transcription,
            transcriptionStatus: file.transcription_status,
          });
        }
        return NextResponse.json({
          type: "other",
          message: "Tipo de arquivo não suportado para visualização",
        });
      }
      return NextResponse.json(file);
    }
    if (action === "download" || action === "content" || action === "stream")
      return NextResponse.json(
        { error: "Arquivo não encontrado" },
        { status: 404 },
      );
    const upload = await getUpload(id);
    if (upload)
      return NextResponse.json({
        upload,
        files: await getExtractedFilesByUpload(id),
      });
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  } catch (error) {
    console.error(
      "Falha ao buscar arquivo",
      error instanceof Error ? error.name : "Error",
    );
    return NextResponse.json(
      { error: "Não foi possível consultar o arquivo no Supabase" },
      { status: 500 },
    );
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1)
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    const file = await getExtractedFile(id);
    if (file) {
      await deleteStoredFile(file.file_path);
      await deleteExtractedFile(id);
      return NextResponse.json({ success: true });
    }
    const upload = await getUpload(id);
    if (!upload)
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    await deleteUpload(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível excluir no Supabase" },
      { status: 500 },
    );
  }
}
