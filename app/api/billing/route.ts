import { validFileSize, TOKEN_BLOCK_BYTES } from "@/lib/upload-capacity";
import { isAdministrator } from "@/lib/administrator";
import { billingMode, walletColumns } from "@/lib/billing-mode";
import { paymentsAvailable } from "@/lib/stripe-readiness";
import { transaction } from "@/lib/transaction";
import { randomUUID } from "node:crypto";
import { withWorkspace, billingEnabled, workspace } from "@/lib/workspace";
import { query } from "@/lib/postgres";
import { offers, stripeClient, tokenCost, reconcileReservations } from "@/lib/billing";
export const runtime = "nodejs";
export const GET = withWorkspace(async request => {
 const requestedSize = new URL(request.url).searchParams.get("size");
 const size = requestedSize === null ? 1 : Number(requestedSize);
 if (!validFileSize(size)) return Response.json({error:"Tamanho de arquivo inválido"},{status:400});
 if (!billingEnabled()) return Response.json({ enabled: false });
 const actor = workspace(), wallet = walletColumns();
 await reconcileReservations(actor.owner);
 const account = (await query(`SELECT free_used,${wallet.balance} AS token_balance,${wallet.customer} AS stripe_customer_id FROM public.extraction_accounts WHERE owner_key=$1`, [actor.owner])).rows[0];
 const configured = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.APP_URL;
 const catalog = configured ? await Promise.all(offers().map(async offer => {
  const price = await stripeClient().prices.retrieve(offer.price!);
  return { kind: offer.kind, tokens: offer.tokens, amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval };
 })) : [];
 return Response.json({ enabled: true, isAdmin: isAdministrator(), paymentsAvailable: configured && await paymentsAvailable(), testMode: /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || ""), email: actor.email, loggedIn: !!actor.userId, freeAvailable: !account.free_used, tokens: account.token_balance, tokenCost: tokenCost(size), tokenBlockBytes: TOKEN_BLOCK_BYTES, canManage: !!account.stripe_customer_id, offers: catalog });
});
export const POST = withWorkspace(async request => {
 if (!billingEnabled()) return Response.json({ error: "Cobrança ainda não ativada" }, { status: 503 });
 if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origem inválida" }, { status: 403 });
 const actor = workspace(), wallet = walletColumns();
 if (!actor.userId) return Response.json({ error: "Entre na sua conta para continuar" }, { status: 401 });
 const appUrl = process.env.APP_URL;
 if (!appUrl || !process.env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Pagamento ainda não configurado" }, { status: 503 });
 let input: {kind?:string};
 try {input=await request.json();} catch {return Response.json({error:"Pedido inválido"},{status:400});}
 if(input.kind !== "portal" && !await paymentsAvailable()) return Response.json({error:"Pagamentos temporariamente indisponíveis. A conta Stripe aguarda liberação para recebimentos."},{status:503});
 try { return await transaction(async client => {
  const stripe = stripeClient();
  const formEnabled = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").startsWith("pk_" + billingMode() + "_");
  const formOptions = { apiVersion: "2026-03-25.dahlia" };
  let customer = (await client.query(`SELECT ${wallet.customer} AS stripe_customer_id FROM public.extraction_accounts WHERE owner_key=$1 FOR UPDATE`, [actor.owner])).rows[0]?.stripe_customer_id;
  if(input.kind === "portal" && !customer) return Response.json({error:"Nenhum pagamento vinculado à sua conta neste ambiente."},{status:400});
  if (!customer) {
   const created = await stripe.customers.create({ email: actor.email, metadata: { user_id: actor.userId } }, { idempotencyKey: "customer:" + actor.userId });
   await client.query(`UPDATE public.extraction_accounts SET ${wallet.customer}=$2 WHERE owner_key=$1`, [actor.owner, created.id]); customer = created.id;
  }
  if (input.kind === "portal") return Response.json({ url: (await stripe.billingPortal.sessions.create({ customer, configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID, return_url: appUrl })).url });
  const offer = offers().find(o => o.kind === input.kind);
  if (!offer) return Response.json({ error: "Plano não configurado" }, { status: 400 });
  const price = await stripe.prices.retrieve(offer.price!);
  if (price.livemode !== (billingMode()==="live") || !price.active || (offer.kind === "subscription") !== !!price.recurring) throw new Error("Preço inválido");
  if (offer.kind === "subscription") {
   const subscriptions = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
   if (subscriptions.data.some(s => ["active","trialing","past_due","unpaid","incomplete","paused"].includes(s.status))) return Response.json({ error: "Você já possui uma assinatura. Use Gerenciar assinatura." }, { status: 409 });
  }
  if (offer.kind === "subscription") {
   const existing = (await client.query("SELECT stripe_session_id FROM public.billing_orders WHERE owner_key=$1 AND billing_mode=$2 AND kind='subscription' AND stripe_session_id IS NOT NULL ORDER BY created_at DESC LIMIT 1", [actor.owner,billingMode()])).rows[0];
   if (existing) {
    const previous = await stripe.checkout.sessions.retrieve(existing.stripe_session_id, {}, formEnabled ? formOptions : {});
    if (previous.status === "open") {
     if (formEnabled && previous.ui_mode === "form" && previous.client_secret) return Response.json({ client_secret: previous.client_secret });
     if (!formEnabled && previous.url) return Response.json({ url: previous.url });
     await stripe.checkout.sessions.expire(previous.id);
    }
   }
  }
  const id = randomUUID();
  await client.query("INSERT INTO public.billing_orders(id,owner_key,kind,price_id,tokens,billing_mode) VALUES($1,$2,$3,$4,$5,$6)", [id, actor.owner, offer.kind, offer.price, offer.tokens,billingMode()]);
  const session = await stripe.checkout.sessions.create({
   customer, mode: offer.kind === "subscription" ? "subscription" : "payment",
   line_items: [{ price: offer.price!, quantity: 1 }], metadata: { order_id: id },
   ...(offer.kind === "subscription" ? { subscription_data: { metadata: { order_id: id } } } : {}),
   ...(formEnabled ? {
    ui_mode: "form" as const, billing_address_collection: "auto" as const,
    phone_number_collection: { enabled: false }, automatic_tax: { enabled: false },
    ...(offer.kind === "subscription" ? { payment_method_collection: "always" as const } : {}),
    submit_type: "auto" as const, integration_identifier: "custom_embedded_web_0001",
   } : { success_url: appUrl + "/?payment=success", cancel_url: appUrl + "/?payment=canceled" }),
  }, { idempotencyKey: "checkout:" + id, ...(formEnabled ? formOptions : {}) });
  await client.query("UPDATE public.billing_orders SET stripe_session_id=$2 WHERE id=$1", [id, session.id]);
  return Response.json(formEnabled ? { client_secret: session.client_secret } : { url: session.url });
 }); } catch { return Response.json({ error: "Não foi possível abrir o pagamento. Tente novamente." }, { status: 503 }); }
});
