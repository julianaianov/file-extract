import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing";
import { getPool } from "@/lib/postgres";
export const runtime = "nodejs";
export async function POST(request: Request) {
 if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Webhook não configurado" }, { status: 503 });
 let event: Stripe.Event;
 const stripe = stripeClient();
 try { event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") || "", process.env.STRIPE_WEBHOOK_SECRET); }
 catch { return Response.json({ error: "Assinatura inválida" }, { status: 400 }); }
 let orderId: string | undefined, source: string | undefined, customer: string | undefined, expectedKind: string | undefined, subscriptionPrice: string | undefined;
 try {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
   const session = event.data.object as Stripe.Checkout.Session;
   if (session.mode === "payment" && session.payment_status === "paid") {
    orderId = session.metadata?.order_id; source = "checkout:" + session.id; expectedKind = "tokens";
    customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
   }
  } else if (event.type === "invoice.paid") {
   const invoice = event.data.object as Stripe.Invoice;
   const sub = invoice.parent?.subscription_details?.subscription;
   if (sub && invoice.status === "paid" && invoice.amount_paid > 0 && ["subscription_create", "subscription_cycle"].includes(invoice.billing_reason || "")) {
    const subscription = await stripe.subscriptions.retrieve(typeof sub === "string" ? sub : sub.id);
    subscriptionPrice = subscription.items.data[0]?.price.id;
    orderId = subscription.metadata.order_id; source = "invoice:" + invoice.id; expectedKind = "subscription";
    customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
   }
  }
  const client = await getPool().connect();
  try {
   await client.query("BEGIN");
   const inserted = await client.query("INSERT INTO public.stripe_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id", [event.id, event.type]);
   if (inserted.rowCount && orderId && source) {
    const order = (await client.query("SELECT o.*,a.stripe_customer_id FROM public.billing_orders o JOIN public.extraction_accounts a ON a.owner_key=o.owner_key WHERE o.id=$1", [orderId])).rows[0];
    if (!order || (subscriptionPrice && subscriptionPrice !== order.price_id) || order.kind !== expectedKind || order.stripe_customer_id !== customer || !order.stripe_session_id) throw new Error("Pedido indisponível ou incompatível");
    if (expectedKind === "tokens" && source !== "checkout:" + order.stripe_session_id) throw new Error("Sessão incompatível");
    const grant = await client.query("INSERT INTO public.billing_grants(source_id,owner_key,tokens) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING tokens", [source, order.owner_key, order.tokens]);
    if (grant.rowCount) await client.query("UPDATE public.extraction_accounts SET token_balance=token_balance+$2 WHERE owner_key=$1", [order.owner_key, order.tokens]);
   }
   await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return Response.json({ received: true });
 } catch { return Response.json({ error: "Não foi possível registrar o pagamento" }, { status: 500 }); }
}
