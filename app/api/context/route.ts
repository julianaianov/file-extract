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

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';

export const runtime = 'nodejs';

type ContextResult = {
  fileId: number;
  filename: string;
  upload_id: number;
  startLine: number;
  matchLineNumber: number;
  lines: Array<{ lineNumber: number; text: string; isMatch: boolean }>;
};

function getLines(text: string): string[] {
  // Normaliza quebras de linha de diferentes plataformas
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('keyword') || '').trim();
    const uploadIdRaw = searchParams.get('uploadId');
    const windowSize = Number(searchParams.get('window') || '5');
    const limit = Number(searchParams.get('limit') || '10');

    if (!keyword) {
      return NextResponse.json({ error: 'Parâmetro "keyword" é obrigatório' }, { status: 400 });
    }

    const db = getDb();
    const params: any[] = [];
    let query = `SELECT id, filename, upload_id, content_text, file_path
                 FROM extracted_files
                 WHERE file_type = 'text'`;
    if (uploadIdRaw) {
      query += ' AND upload_id = ?';
      params.push(Number(uploadIdRaw));
    }
    // Prioriza arquivos típicos de chat
    query += ' ORDER BY CASE WHEN filename LIKE \'%chat%\' THEN 0 ELSE 1 END, id DESC';

    const files = db.prepare(query).all(...params) as Array<{
      id: number;
      filename: string;
      upload_id: number;
      content_text: string | null;
      file_path: string;
    }>;

    const results: ContextResult[] = [];
    const lowerNeedle = keyword.toLowerCase();

    for (const f of files) {
      let text = f.content_text ?? '';
      if (!text && fs.existsSync(f.file_path)) {
        try {
          text = fs.readFileSync(f.file_path, 'utf8');
        } catch {
          // ignore read errors
        }
      }
      if (!text) continue;

      const lines = getLines(text);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerNeedle)) {
          const start = Math.max(0, i - windowSize);
          const end = Math.min(lines.length - 1, i + windowSize);
          const slice: Array<{ lineNumber: number; text: string; isMatch: boolean }> = [];
          for (let ln = start; ln <= end; ln++) {
            slice.push({
              lineNumber: ln + 1,
              text: lines[ln],
              isMatch: ln === i,
            });
          }
          results.push({
            fileId: f.id,
            filename: f.filename,
            upload_id: f.upload_id,
            startLine: start + 1,
            matchLineNumber: i + 1,
            lines: slice,
          });
          if (results.length >= limit) {
            return NextResponse.json({ results, total: results.length });
          }
        }
      }
    }

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error('Erro no contexto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}


