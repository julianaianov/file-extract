import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { query, getPool } from "./postgres";
export interface Workspace { owner: string; userId: string | null; email?: string; emailConfirmed?: boolean; }
const context = new AsyncLocalStorage<Workspace>();
export const billingEnabled = () => process.env.BILLING_ENABLED === "true";
export function workspace() {
 const value = context.getStore();
 if (!value) throw new Error("Contexto de conta ausente");
 return value;
}
export function ownerScope(): string | null { return billingEnabled() ? workspace().owner : null; }
export async function identify(request: Request) {
 const parsed = parseCookieHeader(request.headers.get("cookie") || "");
 const changes: string[] = [];
 let guest = parsed.find(c => c.name === "fe_guest")?.value;
 if (!guest || !/^[0-9a-f-]{36}$/i.test(guest)) {
  guest = randomUUID();
  changes.push(serializeCookieHeader("fe_guest", guest, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 31536000 }));
 }
 let dataUserConfirmed = false;
 let identity: Workspace = { owner: "guest:" + guest, userId: null };
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (url && key && parsed.some(c => c.name.startsWith("sb-"))) {
  const client = createServerClient(url, key, { cookies: { getAll: () => parsed.map(c => ({ name: c.name, value: c.value || "" })), setAll: list => list.forEach(c => changes.push(serializeCookieHeader(c.name, c.value, c.options))) } });
  const { data, error } = await client.auth.getUser();
  if (error && error.status && error.status >= 500) throw new Error("Não foi possível validar a sessão");
  dataUserConfirmed = !!data.user?.email_confirmed_at;
  if (data.user && !data.user.is_anonymous) identity = { owner: "user:" + data.user.id, userId: data.user.id, email: data.user.email, emailConfirmed: dataUserConfirmed };
 }
 if (billingEnabled()) {
  await query("INSERT INTO public.extraction_accounts(owner_key) VALUES($1) ON CONFLICT DO NOTHING", [identity.owner]);
  if (identity.userId) {
   const client = await getPool().connect();
   try {
    await client.query("BEGIN");
    const claimed = await client.query("UPDATE public.extraction_accounts SET claimed_by=$2 WHERE owner_key=$1 AND claimed_by IS NULL AND NOT EXISTS(SELECT 1 FROM public.extraction_charges WHERE owner_key=$1 AND state='reserved') RETURNING free_used", ["guest:" + guest, identity.owner]);
    if (claimed.rows.length) {
     if (claimed.rows[0].free_used) await client.query("UPDATE public.extraction_accounts SET free_used=true WHERE owner_key=$1", [identity.owner]);
     await client.query("UPDATE public.uploads SET owner_key=$1 WHERE owner_key=$2", [identity.owner, "guest:" + guest]);
    }
    if (dataUserConfirmed && identity.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) await client.query("UPDATE public.uploads SET owner_key=$1 WHERE owner_key IS NULL", [identity.owner]);
    await client.query("COMMIT");
   } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }
 }
 return { identity, changes };
}
export function withWorkspace<A extends unknown[]>(handler: (request: Request, ...args: A) => Promise<Response>) {
 return async (request: Request, ...args: A) => {

  try {
   const { identity, changes } = await identify(request);
   const response = await context.run(identity, () => handler(request, ...args));
   changes.forEach(cookie => response.headers.append("Set-Cookie", cookie));
   response.headers.set("Cache-Control", "private, no-store");
   return response;
  } catch { return Response.json({ error: "Não foi possível consultar sua conta. Tente novamente." }, { status: 503 }); }
 };
}
export async function canReadUpload(id: number) {
 const owner = ownerScope();
 if (!owner) return true;
 return !!(await query("SELECT 1 FROM public.uploads WHERE id=$1 AND owner_key=$2", [id, owner])).rowCount;
}
