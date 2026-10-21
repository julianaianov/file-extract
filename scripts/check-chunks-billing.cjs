const fs = require("fs"), path = require("path"), assert = require("node:assert/strict"), ts = require("typescript"), Module = require("module"), { randomUUID } = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name,parent,...rest) { return resolve.call(this,name.startsWith("@/")?path.join(process.cwd(),name.slice(2)):name,parent,...rest); };
require.extensions[".ts"] = (mod,filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const { query, getPool } = require("../lib/postgres.ts"), sessions = require("../app/api/upload/sessions/route.ts"), parts = require("../app/api/upload/sessions/[id]/route.ts"), db = require("../lib/db.ts"), { withWorkspace } = require("../lib/workspace.ts"), billing = require("../lib/billing.ts"), { POST: webhook } = require("../app/api/billing/webhook/route.ts");
const guest = randomUUID(), other = randomUUID(), owner = "guest:" + guest;
const cookie = "fe_guest=" + guest, ids = [], sessionIds = [], eventIds = [];
const request = (url,options={}) => new Request("http://localhost"+url,{...options,headers:{cookie,...options.headers}});
(async()=>{
 try {
  console.log("Teste: partes");
  process.env.BILLING_ENABLED="false";
  const pdf = Buffer.concat([require("./pdf-fixture.cjs").makePdf(),Buffer.alloc(5*1024*1024,32)]);
  const created = await sessions.POST(request("/api/upload/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:"large.pdf",size:pdf.length})}));
  assert.equal(created.status,200);const session=await created.json();sessionIds.push(session.id);
  const context={params:Promise.resolve({id:session.id})};
  let response=await parts.POST(request("/finalize",{method:"POST"}),context);assert.equal(response.status,409);
  response=await parts.PUT(request("/part?part=0",{method:"PUT",headers:{cookie:"fe_guest="+other},body:pdf.subarray(0,session.chunkSize)}),context);assert.equal(response.status,409);
  for(let part=0;part<session.count;part++) { const data=pdf.subarray(part*session.chunkSize,(part+1)*session.chunkSize); response=await parts.PUT(request("/part?part="+part,{method:"PUT",body:data}),context);assert.equal(response.status,200); }
  response=await parts.POST(request("/finalize",{method:"POST"}),context);const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));ids.push(result.uploadId);
  const files=await db.getExtractedFilesByUpload(result.uploadId);assert.equal(files.length,1);
  console.log("Teste: leitura original");
  const stored=await require("../lib/storage.ts").readStoredFile(files[0].file_path);assert.deepEqual(stored,pdf);
  console.log("Teste: finalizacao repetida");
  const repeated=await (await parts.POST(request("/finalize",{method:"POST"}),context)).json();assert.equal(repeated.uploadId,result.uploadId);
  assert.equal((await query("SELECT count(*)::int AS n FROM public.upload_chunks WHERE session_id=$1",[session.id])).rows[0].n,0);
  console.log("Teste: gratuidade");
  process.env.BILLING_ENABLED="true";
  const gate=withWorkspace(async()=>{const charge=await billing.reserveExtraction();return Response.json({charge});});
  const calls=await Promise.all([gate(request("/gate")),gate(request("/gate"))]);
  assert.equal(calls.filter(r=>r.status===200).length,1);
  const denied=calls.find(r=>r.status!==200); // wrapper returns 503 for uncaught billing errors; processUpload maps them to 401/402
  assert.ok(denied);
  const charge=(await calls.find(r=>r.status===200).json()).charge;
  await billing.refundExtraction(charge);await billing.refundExtraction(charge);
  const account=(await query("SELECT * FROM public.extraction_accounts WHERE owner_key=$1",[owner])).rows[0];assert.equal(account.free_used,false);
  console.log("Teste: isolamento");
  const scoped=withWorkspace(async()=>{const upload=await db.createUpload("private.pdf","private.pdf",1);ids.push(upload);await db.createExtractedFile(upload,"private.txt","private/"+upload,"text",1,"text/plain","secret");return Response.json({upload});});
  const upload=(await (await scoped(request("/create"))).json()).upload;
  const reader=withWorkspace(async()=>Response.json({files:await db.searchFiles({},true),upload:await db.getUpload(upload)}));
  const hidden=await (await reader(request("/read",{headers:{cookie:"fe_guest="+other}}))).json();assert.equal(hidden.files.length,0);assert.equal(hidden.upload,undefined);
  const visible=await (await reader(request("/read"))).json();assert.equal(visible.files.length,1);
  console.log("Teste: webhooks");
  process.env.STRIPE_SECRET_KEY="sk_test_local_fixture";process.env.STRIPE_WEBHOOK_SECRET="whsec_local_fixture";
  const order=randomUUID(), customer="cus_fixture_"+guest.replaceAll("-",""), checkout="cs_fixture_"+guest;
  await query("UPDATE public.extraction_accounts SET stripe_customer_id=$2 WHERE owner_key=$1",[owner,customer]);
  await query("INSERT INTO public.billing_orders(id,owner_key,kind,price_id,tokens,stripe_session_id) VALUES($1,$2,'tokens','price_fixture',10,$3)",[order,owner,checkout]);
  const event={id:"evt_fixture_"+guest,type:"checkout.session.completed",data:{object:{id:checkout,mode:"payment",payment_status:"paid",customer,metadata:{order_id:order}}}};
  const stripe=billing.stripeClient();
  const deliver=async ev=>{eventIds.push(ev.id);const payload=JSON.stringify(ev),sig=stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});return webhook(new Request("http://localhost/webhook",{method:"POST",headers:{"stripe-signature":sig},body:payload}));};
  response=await deliver(event);assert.equal(response.status,200);
  response=await deliver(event);assert.equal(response.status,200);
  response=await deliver({...event,id:event.id+"_again",type:"checkout.session.async_payment_succeeded"});assert.equal(response.status,200);
  assert.equal((await query("SELECT token_balance FROM public.extraction_accounts WHERE owner_key=$1",[owner])).rows[0].token_balance,10);
  response=await webhook(new Request("http://localhost/webhook",{method:"POST",headers:{"stripe-signature":"bad"},body:"{}"}));assert.equal(response.status,400);
  console.log("PASS: PDF >4MB em partes, bytes originais, isolamento, partes incompletas, reenvio idempotente, gratuidade concorrente, estorno unico e webhook assinado sem credito duplicado");
 } finally {
  process.env.BILLING_ENABLED="false";
  for(const id of ids)await db.deleteUpload(id);
  for(const id of sessionIds)await query("DELETE FROM public.upload_sessions WHERE id=$1",[id]);
  await query("DELETE FROM public.admin_notifications WHERE payload->>'owner_key'=$1",[owner]);
  await query("DELETE FROM public.billing_grants WHERE owner_key=$1",[owner]);await query("DELETE FROM public.billing_orders WHERE owner_key=$1",[owner]);await query("DELETE FROM public.extraction_charges WHERE owner_key=$1",[owner]);await query("DELETE FROM public.extraction_accounts WHERE owner_key=ANY($1::text[])",[[owner,"guest:"+other]]);
  if(eventIds.length)await query("DELETE FROM public.stripe_events WHERE id=ANY($1::text[])",[eventIds]);
  await getPool().end();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
