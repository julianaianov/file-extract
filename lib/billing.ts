import { extractionUnits } from "./upload-capacity";
import Stripe from "stripe";
import { isAdministrator } from "./administrator";
import { billingMode, walletColumns } from "./billing-mode";
import { randomUUID } from "node:crypto";
import { getPool, query } from "./postgres";
import { billingEnabled, workspace } from "./workspace";
export function stripeClient() {
 if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe ainda não configurada");
 return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 20000, maxNetworkRetries: 1 });
}
function positive(name: string) { const n = Number(process.env[name]); return Number.isSafeInteger(n) && n > 0 ? n : null; }
export function offers() {
 return [
  { kind: "tokens" as const, price: process.env.STRIPE_TOKEN_PRICE_ID, tokens: positive("STRIPE_TOKEN_PACK_SIZE") },
  { kind: "subscription" as const, price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, tokens: positive("STRIPE_SUBSCRIPTION_TOKENS") },
 ].filter(o => o.price && o.tokens);
}
export function tokenCost(size = 1) { const base = positive("EXTRACTION_TOKEN_COST"); if (!base) return null; const cost = base * extractionUnits(size); return Number.isSafeInteger(cost) && cost <= 2147483647 ? cost : null; }
export async function reserveExtraction(size = 1) {
 if (!billingEnabled() || isAdministrator()) return null;
 const actor = workspace(), wallet = walletColumns();
 await reconcileReservations(actor.owner);
 const client = await getPool().connect(), id = randomUUID();
 try {
  await client.query("BEGIN");
  const account = (await client.query("SELECT * FROM public.extraction_accounts WHERE owner_key=$1 FOR UPDATE", [actor.owner])).rows[0];
  if (!account) throw new Error("Conta não encontrada");
  let source = "free", amount = 0;
  if (account.free_used) {
   if (!actor.userId) throw new BillingError("Seu documento gratuito já foi utilizado. Entre na sua conta para continuar.", 401);
   const cost = tokenCost(size);
   if (!cost) throw new BillingError("A cobrança está sendo configurada. Tente novamente em breve.", 503);
   if (account[wallet.balance] < cost) throw new BillingError("Você precisa de uma assinatura ou de tokens para extrair outro documento.", 402);
   source = "tokens"; amount = cost;
   await client.query(`UPDATE public.extraction_accounts SET ${wallet.balance}=${wallet.balance}-$2 WHERE owner_key=$1`, [actor.owner, amount]);
  } else await client.query("UPDATE public.extraction_accounts SET free_used=true WHERE owner_key=$1", [actor.owner]);
  await client.query("INSERT INTO public.extraction_charges(id,owner_key,source,amount,billing_mode) VALUES($1,$2,$3,$4,$5)", [id, actor.owner, source, amount, billingMode()]);
  await client.query("COMMIT"); return id;
 } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
export class BillingError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function completeExtraction(id: string | null, uploadId: number) {
 if (id) await query("UPDATE public.extraction_charges SET state='completed',upload_id=$2 WHERE id=$1 AND state='reserved'", [id, uploadId]);
}
export async function refundExtraction(id: string | null) {
 if (!id) return;
 const client = await getPool().connect();
 try {
  await client.query("BEGIN");
  const owner = (await client.query("SELECT owner_key FROM public.extraction_charges WHERE id=$1", [id])).rows[0]?.owner_key;
  if (owner) await client.query("SELECT 1 FROM public.extraction_accounts WHERE owner_key=$1 FOR UPDATE", [owner]);
  const charge = (await client.query("UPDATE public.extraction_charges SET state='refunded' WHERE id=$1 AND state='reserved' RETURNING *", [id])).rows[0];
  if (charge) { const wallet=walletColumns(charge.billing_mode); await client.query(charge.source === "free" ? "UPDATE public.extraction_accounts SET free_used=false WHERE owner_key=$1" : `UPDATE public.extraction_accounts SET ${wallet.balance}=${wallet.balance}+$2 WHERE owner_key=$1`, charge.source === "free" ? [charge.owner_key] : [charge.owner_key, charge.amount]); }
  await client.query("COMMIT");
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}

export async function attachExtraction(id: string | null, uploadId: number) {
 if (id) await query("UPDATE public.extraction_charges SET upload_id=$2 WHERE id=$1 AND state='reserved'", [id, uploadId]);
}
export async function reconcileReservations(owner: string) {
 const client = await getPool().connect();
 try {
  await client.query("BEGIN");
  await client.query("SELECT 1 FROM public.extraction_accounts WHERE owner_key=$1 FOR UPDATE", [owner]);
  const charges = (await client.query("SELECT c.*,u.status AS upload_status FROM public.extraction_charges c LEFT JOIN public.uploads u ON u.id=c.upload_id WHERE c.owner_key=$1 AND c.state='reserved' AND c.created_at < now()-interval '10 minutes' FOR UPDATE OF c", [owner])).rows;
  for (const charge of charges) {
   const wallet=walletColumns(charge.billing_mode);
   if (charge.upload_status === "completed") await client.query("UPDATE public.extraction_charges SET state='completed' WHERE id=$1", [charge.id]);
   else {
    await client.query("UPDATE public.extraction_charges SET state='refunded' WHERE id=$1", [charge.id]);
    if (charge.source === "free") await client.query("UPDATE public.extraction_accounts SET free_used=false WHERE owner_key=$1", [owner]);
    else await client.query(`UPDATE public.extraction_accounts SET ${wallet.balance}=${wallet.balance}+$2 WHERE owner_key=$1`, [owner,charge.amount]);
    if (charge.upload_id) await client.query("DELETE FROM public.uploads WHERE id=$1 AND owner_key=$2", [charge.upload_id, owner]);
   }
  }
  await client.query("COMMIT");
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
