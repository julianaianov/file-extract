import { NextResponse } from 'next/server';
import { getExtractedFile, updateContentText } from '@/lib/db';
import { isSearchEnabled, updateExtractedFileInIndex } from '@/lib/search';
import { extractTextFromImage } from '@/lib/ocr';
import { readStoredFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'ID do arquivo é obrigatório' }, { status: 400 });
    }
    const file = await getExtractedFile(fileId);
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }
    if (file.file_type !== 'image') {
      return NextResponse.json({ error: 'Apenas imagens podem ser processadas' }, { status: 400 });
    }


    const text = await extractTextFromImage(await readStoredFile(file.file_path));
    await updateContentText(fileId, text);

    if (isSearchEnabled()) {
      const updated = await getExtractedFile(fileId);
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
