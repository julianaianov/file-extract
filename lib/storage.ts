import { query } from "./postgres";
const PART = 3 * 1024 * 1024;
export async function saveStoredFile(key: string, uploadId: number, buffer: Buffer) {
 // Empty parent contents identifies segmented storage; legacy bytea rows remain readable.
 await query("INSERT INTO public.file_contents(path,upload_id,contents) VALUES($1,$2,$3)", [key, uploadId, buffer.length <= PART ? buffer : Buffer.alloc(0)]);
 if (buffer.length > PART) for (let offset = 0; offset < buffer.length; offset += PART) {
  await query("INSERT INTO public.file_content_parts(path,part,contents) VALUES($1,$2,$3)", [key, offset / PART, buffer.subarray(offset, offset + PART)]);
 }
}
export async function storedFileSize(key: string): Promise<number> {
 const row = (await query("SELECT CASE WHEN octet_length(contents)>0 THEN octet_length(contents)::bigint ELSE (SELECT coalesce(sum(octet_length(p.contents)),0) FROM public.file_content_parts p WHERE p.path=f.path) END AS size FROM public.file_contents f WHERE path=$1", [key])).rows[0];
 if (!row) throw new Error("Arquivo não encontrado no Supabase");
 return Number(row.size);
}
export async function readStoredRange(key: string, start: number, end: number): Promise<Buffer> {
 const row = (await query("SELECT octet_length(contents) AS size FROM public.file_contents WHERE path=$1", [key])).rows[0];
 if (!row) throw new Error("Arquivo não encontrado no Supabase");
 if (row.size > 0) return (await query("SELECT substring(contents FROM $2::integer FOR $3::integer) AS contents FROM public.file_contents WHERE path=$1", [key, start+1, end-start+1])).rows[0].contents;
 const parts: Buffer[] = [];
 for (let part = Math.floor(start / PART); part <= Math.floor(end / PART); part++) {
  const item = (await query("SELECT substring(contents FROM $3::integer FOR $4::integer) AS contents FROM public.file_content_parts WHERE path=$1 AND part=$2", [key, part, Math.max(0,start-part*PART)+1, Math.min(end+1,(part+1)*PART)-Math.max(start,part*PART)])).rows[0];
  if (!item) throw new Error("Parte do arquivo indisponível");
  parts.push(item.contents);
 }
 return Buffer.concat(parts);
}
export async function readStoredFile(key: string): Promise<Buffer> {
 const size = await storedFileSize(key), parts: Buffer[] = [];
 for (let offset=0; offset<size; offset+=PART) parts.push(await readStoredRange(key,offset,Math.min(size-1,offset+PART-1)));
 return Buffer.concat(parts);
}
export async function deleteStoredFile(key: string) { await query("DELETE FROM public.file_contents WHERE path=$1", [key]); }

export async function saveSessionFile(key: string, uploadId:number, sessionId:string) {
 await query("INSERT INTO public.file_contents(path,upload_id,contents) VALUES($1,$2,$3)",[key,uploadId,Buffer.alloc(0)]);
 await query("INSERT INTO public.file_content_parts(path,part,contents) SELECT $1,part,contents FROM public.upload_chunks WHERE session_id=$2",[key,sessionId]);
}
