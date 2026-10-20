import { query } from "./postgres";
export async function saveStoredFile(
  key: string,
  uploadId: number,
  buffer: Buffer,
) {
  await query(
    "INSERT INTO public.file_contents(path,upload_id,contents) VALUES($1,$2,$3)",
    [key, uploadId, buffer],
  );
}
export async function readStoredFile(key: string): Promise<Buffer> {
  const result = await query(
    "SELECT contents FROM public.file_contents WHERE path=$1",
    [key],
  );
  if (!result.rows[0]) throw new Error("Arquivo não encontrado no Supabase");
  return result.rows[0].contents;
}
export async function deleteStoredFile(key: string) {
  await query("DELETE FROM public.file_contents WHERE path=$1", [key]);
}
