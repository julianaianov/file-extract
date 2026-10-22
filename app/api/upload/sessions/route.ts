import { validFileSize } from "@/lib/upload-capacity";
import { tokenCost } from "@/lib/billing";
import { billingEnabled } from "@/lib/workspace";
import { isAdministrator } from "@/lib/administrator";
import { walletColumns } from "@/lib/billing-mode";
import { randomUUID } from "node:crypto";
import { withWorkspace, workspace } from "@/lib/workspace";
import { getPool } from "@/lib/postgres";
export const runtime = "nodejs";
export const POST = withWorkspace(async request => {
 let input;
 try {input=await request.json();}catch{return Response.json({error:"Pedido inválido"},{status:400});}
 if(!input || typeof input!=="object")return Response.json({error:"Pedido inválido"},{status:400});
 if (typeof input.filename !== "string" || !input.filename.trim() || input.filename.length > 250 || input.filename.includes("\u0000") || !validFileSize(input.size))
  return Response.json({ error: "Informe um arquivo com tamanho válido" }, { status: 400 });
 const client = await getPool().connect(), owner = workspace().owner;
 try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [owner]);
  await client.query("DELETE FROM public.upload_sessions WHERE expires_at < now()");
  const active = (await client.query("SELECT count(*)::int AS count FROM public.upload_sessions WHERE owner_key=$1 AND state IN ('pending','processing')", [owner])).rows[0].count;
  if (active >= 2) { await client.query("ROLLBACK"); return Response.json({ error: "Conclua os envios em andamento antes de iniciar outro." }, { status: 429 }); }
  if (billingEnabled() && !isAdministrator()) {
   const wallet = walletColumns();
   const account = (await client.query(`SELECT free_used,${wallet.balance} AS tokens FROM public.extraction_accounts WHERE owner_key=$1`,[owner])).rows[0];
   if (account?.free_used) {
    const cost = tokenCost(input.size);
    if (!workspace().userId || !cost || account.tokens < cost) { await client.query("ROLLBACK"); return Response.json({error:"Entre na sua conta e adicione tokens para este envio.", requiredTokens:cost},{status:workspace().userId?402:401}); }
   }
  }
  const id = randomUUID(), count = Math.ceil(input.size / (3 * 1024 * 1024));
  await client.query("INSERT INTO public.upload_sessions(id,owner_key,filename,custom_name,file_size,chunk_count) VALUES($1,$2,$3,$4,$5,$6)", [id, owner, input.filename, typeof input.customName === "string" ? input.customName.slice(0,150) : null, input.size, count]);
  await client.query("COMMIT");
  return Response.json({ id, chunkSize: 3 * 1024 * 1024, count });
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
});
