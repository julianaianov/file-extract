import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isSearchEnabled, searchIdsByFuzzyKeyword } from '@/lib/search';

export const runtime = 'nodejs';

type Line = { num: number; text: string };

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function isFuzzyMatch(line: string, q: string): boolean {
  const l = line.toLowerCase();
  const needle = q.toLowerCase();
  if (l.includes(needle)) return true;
  const tokens = l.split(/[^a-z0-9áàâãéêíóôõúç]+/i).filter(Boolean);
  const maxDist = Math.max(1, Math.floor(Math.min(needle.length, 8) * 0.3));
  for (const t of tokens) {
    if (Math.abs(t.length - needle.length) > maxDist) continue;
    if (levenshtein(t, needle) <= maxDist) return true;
  }
  return false;
}

function findContexts(lines: string[], q: string, windowSize: number, maxResults: number) {
  const matches: Array<{
    index: number;
    before: Line[];
    match: Line;
    after: Line[];
  }> = [];
  const lowerQ = q.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (isFuzzyMatch(lines[i], lowerQ)) {
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
    const qRaw = (searchParams.get('q') || searchParams.get('keyword') || '').trim();
    const q = qRaw;
    if (!q) {
      return NextResponse.json({ error: 'Parâmetro q é obrigatório' }, { status: 400 });
    }
    const uploadIdStr = searchParams.get('uploadId');
    const windowSize = Math.max(0, Math.min(20, parseInt(searchParams.get('window') || '5', 10) || 5));
    const maxResults = Math.max(1, Math.min(100, parseInt(searchParams.get('max') || '20', 10) || 20));

    const db = getDb();
    const files: Array<{ id: number; filename: string; content_text: string | null; upload_id: number }> = [];
    if (isSearchEnabled()) {
      const ids = await searchIdsByFuzzyKeyword(q, 'text', 20);
      for (const id of ids) {
        const f = db
          .prepare(
            `SELECT id, filename, content_text, upload_id
             FROM extracted_files WHERE id = ? AND file_type = 'text'`
          )
          .get(id) as any;
        if (f && f.content_text) files.push(f);
        if (uploadIdStr && f?.upload_id !== Number(uploadIdStr)) continue;
        if (files.length >= 5) break;
      }
    }
    if (files.length === 0) {
      // fallback: último arquivo de texto (como antes)
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
      if (file && file.content_text) files.push(file);
    }

    if (files.length === 0) {
      return NextResponse.json({ results: [], totalMatches: 0, file: null });
    }

    // Fuzzy contexts across selected files; merge limited results
    const resultsAgg: any[] = [];
    let firstFileMeta: any = null;
    for (const f of files) {
      const rawLines = f.content_text!.split(/\r?\n/);
      const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
      const contexts = findContexts(lines, q, windowSize, maxResults - resultsAgg.length);
      if (!firstFileMeta) firstFileMeta = { id: f.id, filename: f.filename, uploadId: f.upload_id };
      for (const c of contexts) resultsAgg.push(c);
      if (resultsAgg.length >= maxResults) break;
    }

    return NextResponse.json({
      file: firstFileMeta,
      query: q,
      window: windowSize,
      totalMatches: resultsAgg.length,
      results: resultsAgg,
    });
  } catch (error) {
    console.error('Erro ao buscar contexto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}





