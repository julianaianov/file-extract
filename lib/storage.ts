import { query } from "./postgres";
export async function saveStoredFile(key: string, uploadId: number, buffer: Buffer) {
 await query("INSERT INTO public.file_contents(path,upload_id,contents) VALUES($1,$2,$3)", [key, uploadId, buffer]);
}
export async function readStoredFile(key: string): Promise<Buffer> {
 const row = (await query("SELECT octet_length(contents) AS size FROM public.file_contents WHERE path=$1", [key])).rows[0];
 if (!row) throw new Error("Arquivo não encontrado no Supabase");
 const parts: Buffer[] = [], chunkSize = 1024 * 1024;
 for (let start = 0; start < row.size; start += chunkSize) {
  const part = (await query("SELECT substring(contents FROM $2::integer FOR $3::integer) AS contents FROM public.file_contents WHERE path=$1", [key, start + 1, chunkSize])).rows[0];
  if (!part) throw new Error("Arquivo não encontrado no Supabase");
  parts.push(part.contents);
 }
 return Buffer.concat(parts);
}
export async function deleteStoredFile(key: string) { await query("DELETE FROM public.file_contents WHERE path=$1", [key]); }
