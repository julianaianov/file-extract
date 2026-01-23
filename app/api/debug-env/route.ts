import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const hasKey = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 10;
  return NextResponse.json({ hasOpenAIKey: hasKey });
}










