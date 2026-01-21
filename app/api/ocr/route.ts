import { NextResponse } from 'next/server';
import { extractTextFromImage } from '@/lib/ocr';
import { getExtractedFile, updateContentText } from '@/lib/db';
import { isSearchEnabled, updateExtractedFileInIndex } from '@/lib/search';
import fs from 'fs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'ID do arquivo é obrigatório' }, { status: 400 });
    }

    const file = getExtractedFile(fileId);
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }
    if (file.file_type !== 'image') {
      return NextResponse.json({ error: 'Apenas imagens podem ser processadas para OCR' }, { status: 400 });
    }
    if (!fs.existsSync(file.file_path)) {
      return NextResponse.json({ error: 'Arquivo físico não encontrado' }, { status: 404 });
    }

    const text = await extractTextFromImage(file.file_path);
    updateContentText(fileId, text);

    if (isSearchEnabled()) {
      const updated = getExtractedFile(fileId);
      if (updated) await updateExtractedFileInIndex(updated);
    }

    return NextResponse.json({ success: true, fileId, text });
  } catch (error) {
    console.error('Erro no OCR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}


