const fs = require("fs"), path = require("path"), assert = require("node:assert/strict"), ts = require("typescript"), Module = require("module"), { randomUUID } = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name,parent,...rest) { return resolve.call(this,name.startsWith("@/")?path.join(process.cwd(),name.slice(2)):name,parent,...rest); };
require.extensions[".ts"] = (mod,filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const { query, getPool } = require("../lib/postgres.ts"), billing = require("../lib/billing.ts"), {POST:webhook}=require("../app/api/billing/webhook/route.ts");

const actor={owner:"user:billing-mode-"+randomUUID(),userId:randomUUID(),email:"billing-mode@example.invalid"},events=[],orders=[];
const wm=require("../lib/workspace.ts"), savedWorkspace=wm.workspace;wm.workspace=()=>actor;
const status=async()=> (await query("SELECT token_balance,live_token_balance FROM public.extraction_accounts WHERE owner_key=$1",[actor.owner])).rows[0];
(async()=>{process.env.BILLING_ENABLED="true";process.env.EXTRACTION_TOKEN_COST="1";
 try{
  await query("INSERT INTO public.extraction_accounts(owner_key,free_used,token_balance,live_token_balance,stripe_customer_id,live_stripe_customer_id) VALUES($1,true,5,0,$2,$3)",[actor.owner,"cus_test_"+actor.userId,"cus_live_"+actor.userId]);
  process.env.STRIPE_SECRET_KEY="sk_live_fixture";
  await assert.rejects(()=>billing.reserveExtraction(),e=>e.status===402);
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:0});
  await query("UPDATE public.extraction_accounts SET live_token_balance=2 WHERE owner_key=$1",[actor.owner]);
  const live=await billing.reserveExtraction();
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:1});
  process.env.STRIPE_SECRET_KEY="sk_test_fixture";await billing.refundExtraction(live);await billing.refundExtraction(live);
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:2});
  const test=await billing.reserveExtraction();
  process.env.STRIPE_SECRET_KEY="sk_live_fixture";await billing.refundExtraction(test);
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:2});
  const stale=await billing.reserveExtraction();await query("UPDATE public.extraction_charges SET created_at=now()-interval '11 minutes' WHERE id=$1",[stale]);
  process.env.STRIPE_SECRET_KEY="sk_test_fixture";await billing.reconcileReservations(actor.owner);
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:2});
  process.env.STRIPE_SECRET_KEY="sk_live_fixture";process.env.STRIPE_WEBHOOK_SECRET="whsec_live_fixture";
  const id=randomUUID(),session="cs_live_"+id,customer="cus_live_"+actor.userId;
  orders.push(id);
  await query("INSERT INTO public.billing_orders(id,owner_key,kind,price_id,tokens,stripe_session_id,billing_mode) VALUES($1,$2,'tokens','price_live_fixture',20,$3,'live')",[id,actor.owner,session]);
  const deliver=async(livemode,eventId)=>{events.push(eventId);const payload=JSON.stringify({id:eventId,type:"checkout.session.completed",livemode,data:{object:{id:session,mode:"payment",payment_status:"paid",customer,metadata:{order_id:id}}}});const signature=billing.stripeClient().webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});return webhook(new Request("http://localhost/webhook",{method:"POST",headers:{"stripe-signature":signature},body:payload}));};
  assert.equal((await deliver(false,"evt_wrong_"+id)).status,400);
  assert.equal((await deliver(true,"evt_live_"+id)).status,200);
  assert.equal((await deliver(true,"evt_live_"+id)).status,200);
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:22});
  // The same live order cannot be fulfilled by a correctly signed test event.
  process.env.STRIPE_SECRET_KEY="sk_test_fixture";process.env.STRIPE_WEBHOOK_SECRET="whsec_test_fixture";
  assert.equal((await deliver(false,"evt_cross_"+id)).status,500);
  assert.deepEqual(await status(),{token_balance:5,live_token_balance:22});
  const stripeFactory=billing.stripeClient;let checks=0;
  try {
   billing.stripeClient=()=>({accounts:{retrieve:async()=>{checks++;return{charges_enabled:false};}}});
   process.env.STRIPE_SECRET_KEY="sk_live_readiness_fixture";process.env.STRIPE_ACCOUNT_ID="acct_fixture";
   const ready=require("../lib/stripe-readiness.ts");
   assert.equal(await ready.paymentsAvailable(),false);assert.equal(await ready.paymentsAvailable(),false);assert.equal(checks,1);
   billing.stripeClient=()=>({accounts:{retrieve:async()=>({charges_enabled:true})}});
   process.env.STRIPE_SECRET_KEY="sk_live_enabled_fixture";assert.equal(await ready.paymentsAvailable(),true);
  }finally{billing.stripeClient=stripeFactory;}
  console.log("PASS: carteiras teste/produção isoladas, reservas e estornos no saldo correto, reconciliação, webhook de produção idempotente, rejeição de ambiente incorreto e disponibilidade Stripe");
 }finally{
  wm.workspace=savedWorkspace;
  await query("DELETE FROM public.billing_grants WHERE owner_key=$1",[actor.owner]);
  await query("DELETE FROM public.billing_orders WHERE owner_key=$1",[actor.owner]);
  await query("DELETE FROM public.extraction_charges WHERE owner_key=$1",[actor.owner]);
  await query("DELETE FROM public.extraction_accounts WHERE owner_key=$1",[actor.owner]);
  if(events.length)await query("DELETE FROM public.stripe_events WHERE id=ANY($1::text[])",[events]);
  await getPool().end();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
