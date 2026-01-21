import { NextResponse } from 'next/server';
import { getExtractedFile, getExtractedFilesByUpload, getUpload, deleteUpload, deleteExtractedFile } from '@/lib/db';
import { isSearchEnabled, removeExtractedFile, removeByUpload } from '@/lib/search';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

function extractIdFromRequest(request: Request): string | null {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const last = parts[parts.length - 1];
    return last || null;
  } catch {
    return null;
  }
}

function guessMimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.opus': return 'audio/ogg';
    case '.m4a': return 'audio/mp4';
    case '.webm': return 'audio/webm';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

export async function GET(
  request: Request,
  context: any
) {
  try {
    const id = (context?.params?.id as string | undefined) ?? extractIdFromRequest(request) ?? undefined;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!id) {
      return NextResponse.json({ error: 'Parâmetro id ausente' }, { status: 400 });
    }

    // Se a ação for 'download', retornar o arquivo
    if (action === 'download') {
      const file = getExtractedFile(parseInt(id, 10));
      if (!file) {
        return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
      }

      if (!fs.existsSync(file.file_path)) {
        return NextResponse.json({ error: 'Arquivo físico não encontrado' }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(file.file_path);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'Content-Length': String(fileBuffer.length),
        },
      });
    }

    // Se a ação for 'content', retornar o conteúdo para visualização
    if (action === 'content') {
      const file = getExtractedFile(parseInt(id, 10));
      if (!file) {
        return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
      }

      // Para imagens, retornar como base64
      if (file.file_type === 'image') {
        if (!fs.existsSync(file.file_path)) {
          return NextResponse.json({ error: 'Arquivo físico não encontrado' }, { status: 404 });
        }
        const fileBuffer = fs.readFileSync(file.file_path);
        const base64 = fileBuffer.toString('base64');
        const mimeType = file.mime_type && file.mime_type !== 'application/octet-stream'
          ? file.mime_type
          : guessMimeFromFilename(file.filename);
        return NextResponse.json({
          type: 'image',
          mimeType,
          data: `data:${mimeType};base64,${base64}`,
        });
      }

      // Para texto, retornar o conteúdo
      if (file.file_type === 'text') {
        return NextResponse.json({
          type: 'text',
          content: file.content_text || '',
        });
      }

      // Para áudio, retornar como base64
      if (file.file_type === 'audio') {
        if (!fs.existsSync(file.file_path)) {
          return NextResponse.json({ error: 'Arquivo físico não encontrado' }, { status: 404 });
        }
        const fileBuffer = fs.readFileSync(file.file_path);
        const base64 = fileBuffer.toString('base64');
        const mimeType = file.mime_type && file.mime_type !== 'application/octet-stream'
          ? file.mime_type
          : guessMimeFromFilename(file.filename);
        return NextResponse.json({
          type: 'audio',
          mimeType,
          data: `data:${mimeType};base64,${base64}`,
          transcription: file.transcription,
          transcriptionStatus: file.transcription_status,
        });
      }

      return NextResponse.json({ type: 'other', message: 'Tipo de arquivo não suportado para visualização' });
    }

    if (action === 'diag') {
      const cwd = process.cwd();
      const dbPath = path.join(cwd, 'data', 'files.db');
      const exists = fs.existsSync(dbPath);
      const parsed = parseInt(id, 10);
      const probe = getExtractedFile(parsed);
      return NextResponse.json({ cwd, dbPath, exists, rawId: id, parsedId: parsed, probeHasFile: !!probe });
    }

    // Se a ação for 'upload-files', retornar arquivos do upload específico
    if (action === 'upload-files') {
      const files = getExtractedFilesByUpload(parseInt(id, 10));
      return NextResponse.json(files);
    }

    // Retornar informações do arquivo ou upload
    const numId = parseInt(id, 10);

    // Tentar buscar como arquivo extraído
    const file = getExtractedFile(numId);
    if (file) {
      return NextResponse.json(file);
    }

    // Tentar buscar como upload
    const upload = getUpload(numId);
    if (upload) {
      const files = getExtractedFilesByUpload(numId);
      return NextResponse.json({ upload, files });
    }

    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: any
) {
  try {
    const id = (context?.params?.id as string | undefined) ?? extractIdFromRequest(request) ?? undefined;
    if (!id) {
      return NextResponse.json({ error: 'Parâmetro id ausente' }, { status: 400 });
    }
    const numId = parseInt(id, 10);

    // Primeiro tenta deletar arquivo individual
    const file = getExtractedFile(numId);
    if (file) {
      if (fs.existsSync(file.file_path)) {
        try { fs.unlinkSync(file.file_path); } catch {}
      }
      deleteExtractedFile(numId);
      if (isSearchEnabled()) {
        removeExtractedFile(numId).catch(() => {});
      }
      return NextResponse.json({ success: true, message: 'Arquivo deletado com sucesso' });
    }

    // Senão, trata como upload para exclusão em massa
    const upload = getUpload(numId);
    if (!upload) {
      return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 });
    }

    // Deletar arquivos físicos
    const extractDir = path.join(process.cwd(), 'data', 'extracted', upload.filename.replace('.zip', ''));
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true });
    }

    const uploadPath = path.join(process.cwd(), 'data', 'uploads', upload.filename);
    if (fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath);
    }

    // Deletar do banco (cascade deleta os arquivos extraídos)
    deleteUpload(numId);
    if (isSearchEnabled()) {
      removeByUpload(numId).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Upload deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
