import { withWorkspace } from "@/lib/workspace";
import { NextResponse } from 'next/server';
import { getExtractedFile } from '@/lib/db';

export const runtime = 'nodejs';

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idStr = searchParams.get('id');
  const id = idStr ? parseInt(idStr, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }
  const file = await getExtractedFile(id);
  return NextResponse.json({ file });
}











export const GET = withWorkspace(handleGET);
