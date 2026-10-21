import { withWorkspace, workspace } from "@/lib/workspace";
import { query, getPool } from "@/lib/postgres";
import { processBuffer, processingBytes } from "@/lib/process-upload";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
const valid = (id: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
export const PUT = withWorkspace(async (request: Request, context: Context) => {
 const { id } = await context.params, part = Number(new URL(request.url).searchParams.get("part"));
 if (!valid(id) || !Number.isSafeInteger(part) || part < 0) return Response.json({ error: "Parte inválida" }, { status: 400 });
 if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024) return Response.json({ error: "Parte grande demais" }, { status: 413 });
 const bytes = Buffer.from(await request.arrayBuffer());
 const client = await getPool().connect();
 try {
  await client.query("BEGIN");
  const session = (await client.query("SELECT * FROM public.upload_sessions WHERE id=$1 AND owner_key=$2 AND expires_at > now() FOR UPDATE", [id, workspace().owner])).rows[0];
  if (!session || session.state !== "pending") { await client.query("ROLLBACK"); return Response.json({ error: "Envio indisponível ou expirado" }, { status: 409 }); }
  const expected = part === session.chunk_count - 1 ? session.file_size - part * 3 * 1024 * 1024 : 3 * 1024 * 1024;
  if (part >= session.chunk_count || bytes.length !== expected) { await client.query("ROLLBACK"); return Response.json({ error: "Tamanho ou número da parte inválido" }, { status: 400 }); }
  await client.query("INSERT INTO public.upload_chunks(session_id,part,contents) VALUES($1,$2,$3) ON CONFLICT(session_id,part) DO UPDATE SET contents=EXCLUDED.contents", [id, part, bytes]);
  await client.query("COMMIT"); return Response.json({ received: part });
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
});
export const POST = withWorkspace(async (request: Request, context: Context) => {
 const { id } = await context.params;
 if (!valid(id)) return Response.json({ error: "Envio inválido" }, { status: 400 });
 const owner = workspace().owner;
 const claimed = (await query("UPDATE public.upload_sessions SET state='processing' WHERE id=$1 AND owner_key=$2 AND state='pending' AND expires_at > now() RETURNING *", [id, owner])).rows[0];
 if (!claimed) {
  const previous = (await query("SELECT state,result FROM public.upload_sessions WHERE id=$1 AND owner_key=$2 AND expires_at > now()", [id, owner])).rows[0];
  return previous?.state === "completed" ? Response.json(previous.result) : Response.json({ error: "Envio expirado, em processamento ou já encerrado" }, { status: 409 });
 }
 try {
 const chunks = (await query("SELECT part,octet_length(contents) AS size FROM public.upload_chunks WHERE session_id=$1 ORDER BY part", [id])).rows;
 if (chunks.length !== claimed.chunk_count) { await query("UPDATE public.upload_sessions SET state='pending' WHERE id=$1", [id]); return Response.json({ error: "Faltam partes do arquivo. Tente novamente." }, { status: 409 }); }
 if (chunks.reduce((total,c)=>total+c.size,0) !== claimed.file_size) { await query("UPDATE public.upload_sessions SET state='error' WHERE id=$1", [id]); return Response.json({ error: "Arquivo incompleto" }, { status: 422 }); }
 const bytes = Buffer.alloc(processingBytes(claimed.filename,claimed.file_size));
 for (const chunk of chunks) {
  if(chunk.part*3*1024*1024 >= bytes.length) break;
  const row = (await query("SELECT contents FROM public.upload_chunks WHERE session_id=$1 AND part=$2", [id,chunk.part])).rows[0];
  row.contents.copy(bytes,chunk.part*3*1024*1024);
 }
  const response = await processBuffer(bytes, claimed.filename, claimed.custom_name, id, claimed.file_size);
  const result = await response.json();
  await query("UPDATE public.upload_sessions SET state=$2,result=$3 WHERE id=$1", [id, response.ok ? "completed" : "error", result]);
  await query("DELETE FROM public.upload_chunks WHERE session_id=$1", [id]);
  return Response.json(result, { status: response.status });
 } catch(e) { await query("UPDATE public.upload_sessions SET state='error' WHERE id=$1", [id]); throw e; }
});
export const DELETE = withWorkspace(async (_request: Request, context: Context) => {
 const { id } = await context.params;
 if (!valid(id)) return Response.json({ error: "Envio inválido" }, { status: 400 });
 await query("DELETE FROM public.upload_sessions WHERE id=$1 AND owner_key=$2 AND state <> 'processing'", [id, workspace().owner]);
 return Response.json({ deleted: true });
});
