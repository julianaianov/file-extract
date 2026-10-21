import { withWorkspace, workspace } from "@/lib/workspace";
import { query, getPool } from "@/lib/postgres";
import { processUpload } from "@/lib/process-upload";
export const runtime = "nodejs";
export const maxDuration = 60;
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
 const chunks = (await query("SELECT part,contents FROM public.upload_chunks WHERE session_id=$1 ORDER BY part", [id])).rows;
 if (chunks.length !== claimed.chunk_count) { await query("UPDATE public.upload_sessions SET state='pending' WHERE id=$1", [id]); return Response.json({ error: "Faltam partes do arquivo. Tente novamente." }, { status: 409 }); }
 const bytes = Buffer.concat(chunks.map(c => c.contents));
 if (bytes.length !== claimed.file_size) { await query("UPDATE public.upload_sessions SET state='error' WHERE id=$1", [id]); return Response.json({ error: "Arquivo incompleto" }, { status: 422 }); }
 try {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], claimed.filename));
  if (claimed.custom_name) form.append("customName", claimed.custom_name);
  const response = await processUpload(new Request(request.url, { method: "POST", body: form }));
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
