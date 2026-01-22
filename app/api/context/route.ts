import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type Line = { num: number; text: string };

function findContexts(lines: string[], q: string, windowSize: number, maxResults: number) {
  const matches: Array<{
    index: number;
    before: Line[];
    match: Line;
    after: Line[];
  }> = [];
  const lowerQ = q.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerQ)) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(lines.length - 1, i + windowSize);
      const before: Line[] = [];
      for (let j = start; j < i; j++) before.push({ num: j + 1, text: lines[j] });
      const after: Line[] = [];
      for (let j = i + 1; j <= end; j++) after.push({ num: j + 1, text: lines[j] });
      matches.push({
        index: i,
        before,
        match: { num: i + 1, text: lines[i] },
        after,
      });
      if (matches.length >= maxResults) break;
    }
  }
  return matches;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({ error: 'Parâmetro q é obrigatório' }, { status: 400 });
    }
    const uploadIdStr = searchParams.get('uploadId');
    const windowSize = Math.max(0, Math.min(20, parseInt(searchParams.get('window') || '5', 10) || 5));
    const maxResults = Math.max(1, Math.min(100, parseInt(searchParams.get('max') || '20', 10) || 20));

    const db = getDb();
    let file:
      | {
          id: number;
          filename: string;
          content_text: string | null;
          upload_id: number;
        }
      | undefined;

    if (uploadIdStr) {
      const uploadId = parseInt(uploadIdStr, 10);
      file = db
        .prepare(
          `
          SELECT id, filename, content_text, upload_id
          FROM extracted_files
          WHERE file_type = 'text' AND upload_id = ?
          ORDER BY (CASE WHEN filename LIKE '%_chat%' THEN 0 ELSE 1 END), extracted_date DESC
          LIMIT 1
        `
        )
        .get(uploadId) as any;
    } else {
      file = db
        .prepare(
          `
          SELECT id, filename, content_text, upload_id
          FROM extracted_files
          WHERE file_type = 'text'
          ORDER BY (CASE WHEN filename LIKE '%_chat%' THEN 0 ELSE 1 END), extracted_date DESC
          LIMIT 1
        `
        )
        .get() as any;
    }

    if (!file || !file.content_text) {
      return NextResponse.json({ results: [], totalMatches: 0, file: null });
    }

    // Dividir em linhas de mensagem (usa \n)
    const rawLines = file.content_text.split(/\r?\n/);
    const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
    const contexts = findContexts(lines, q, windowSize, maxResults);

    return NextResponse.json({
      file: { id: file.id, filename: file.filename, uploadId: file.upload_id },
      query: q,
      window: windowSize,
      totalMatches: contexts.length,
      results: contexts,
    });
  } catch (error) {
    console.error('Erro ao buscar contexto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

