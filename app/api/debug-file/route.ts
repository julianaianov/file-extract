import { NextResponse } from 'next/server';
import { getExtractedFile } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idStr = searchParams.get('id');
  const id = idStr ? parseInt(idStr, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }
  const file = getExtractedFile(id);
  return NextResponse.json({ file });
}







