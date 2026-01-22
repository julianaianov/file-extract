import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

export async function GET() {
  const cwd = process.cwd();
  const dbPath = path.join(cwd, 'data', 'files.db');
  const exists = fs.existsSync(dbPath);
  return NextResponse.json({ cwd, dbPath, exists });
}







