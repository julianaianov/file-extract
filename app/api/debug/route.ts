import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
export const runtime='nodejs';
export async function GET(){
 try{await query('SELECT 1 FROM public.uploads LIMIT 1');return NextResponse.json({database:'supabase-postgresql',connected:true})}
 catch{return NextResponse.json({database:'supabase-postgresql',connected:false},{status:503})}
}
