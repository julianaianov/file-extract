import { randomUUID } from "node:crypto";
import { withWorkspace, workspace } from "@/lib/workspace";
import { getPool } from "@/lib/postgres";
export const runtime = "nodejs";
export const POST = withWorkspace(async request => {
 const input = await request.json();
 if (typeof input.filename !== "string" || !input.filename.trim() || input.filename.length > 250 || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > 250 * 1024 * 1024)
  return Response.json({ error: "Envie um arquivo de até 250 MB" }, { status: 400 });
 const client = await getPool().connect(), owner = workspace().owner;
 try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [owner]);
  await client.query("DELETE FROM public.upload_sessions WHERE expires_at < now()");
  const active = (await client.query("SELECT count(*)::int AS count FROM public.upload_sessions WHERE owner_key=$1 AND state IN ('pending','processing')", [owner])).rows[0].count;
  if (active >= 2) { await client.query("ROLLBACK"); return Response.json({ error: "Conclua os envios em andamento antes de iniciar outro." }, { status: 429 }); }
  const id = randomUUID(), count = Math.ceil(input.size / (3 * 1024 * 1024));
  await client.query("INSERT INTO public.upload_sessions(id,owner_key,filename,custom_name,file_size,chunk_count) VALUES($1,$2,$3,$4,$5,$6)", [id, owner, input.filename, typeof input.customName === "string" ? input.customName.slice(0,150) : null, input.size, count]);
  await client.query("COMMIT");
  return Response.json({ id, chunkSize: 3 * 1024 * 1024, count });
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
});
