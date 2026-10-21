"use client";
import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { AdminNotifications } from "./admin-notifications";
import { UserRound, Coins, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
type Account = { enabled: boolean; isAdmin?:boolean; paymentsAvailable?: boolean; testMode: boolean; email?: string; loggedIn: boolean; freeAvailable: boolean; tokens: number; tokenCost: number | null; canManage: boolean; offers: { kind: string; tokens: number; amount: number | null; currency: string; interval?: string }[] };
export function AccountPanel() {
 const [paymentPending,setPaymentPending] = useState(false);
 const { data: providers } = useSWR<{google:boolean;unavailable?:boolean}>("/api/auth/providers", async url => { const response=await fetch(url); if(!response.ok) throw Error("Acesso indisponível"); return response.json(); }, { revalidateOnFocus:true, dedupingInterval:10000 });
 const { data, mutate: refresh } = useSWR<Account>("/api/billing", async url => { const r = await fetch(url); if (!r.ok) throw Error("Conta indisponível"); return r.json(); }, { refreshInterval: paymentPending ? 5000 : 0, revalidateOnFocus: true });
 const [open,setOpen] = useState(false), [signup,setSignup] = useState(false), [email,setEmail] = useState(""), [password,setPassword] = useState(""), [busy,setBusy] = useState(false), [message,setMessage] = useState("");
 useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if(params.get("auth")==="error") { setOpen(true); setMessage("Não foi possível concluir o login. Se você cancelou o acesso, pode tentar novamente ou usar e-mail e senha."); }
  const result = params.get("payment");
  if (result === "success") { setOpen(true); setPaymentPending(true); setMessage("Aguardando a confirmação do pagamento. O saldo será atualizado após a confirmação da Stripe."); const timer=setTimeout(()=>setPaymentPending(false),60000); return ()=>clearTimeout(timer); }
 }, []);
 useEffect(() => {
  const required = () => { setOpen(true); setMessage("Entre na sua conta e escolha uma assinatura ou pacote de tokens para continuar."); void refresh(); };
  const updated = () => { void refresh(); };
  window.addEventListener("billing-required", required); window.addEventListener("billing-updated", updated);
  return () => { window.removeEventListener("billing-required",required); window.removeEventListener("billing-updated",updated); };
 }, [refresh]);
 useEffect(() => {
  if (!data?.enabled) return;
  const { data: listener } = supabaseBrowser().auth.onAuthStateChange(() => { void refresh(); void mutate(key => typeof key === "string" && key.startsWith("/api/files")); });
  return () => listener.subscription.unsubscribe();
 }, [data?.enabled,refresh]);
 if (!data?.enabled) return null;
 const checkout = async (kind: string) => {
  setBusy(true); setMessage("");
  try {
   const r = await fetch("/api/billing", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind}) }), result = await r.json();
   if (!r.ok) throw Error(result.error); window.location.assign(result.url);
  } catch(e) { setMessage(e instanceof Error ? e.message : "Pagamento indisponível"); setBusy(false); }
 };
 return <>
  <button className="guide-launch" aria-label={data.isAdmin ? "Administrador" : data.loggedIn ? data.tokens+" tokens" : "Entrar / Planos"} onClick={() => setOpen(true)}><UserRound size={16}/><span>{data.isAdmin ? "Administrador" : data.loggedIn ? data.tokens + " tokens" : "Entrar / Planos"}</span></button>
  {data.isAdmin && <AdminNotifications/>}
  <Dialog open={open} onOpenChange={setOpen}><DialogContent overlayClassName="guide-overlay" className="guide-dialog" style={{backgroundColor:"#101722",backgroundImage:"none",zIndex:101}}>
   <DialogTitle>Seu acesso ao File Extract</DialogTitle>
   <DialogDescription>{data.isAdmin ? "Seu acesso administrativo permite extrações sem cobrança." : data.freeAvailable ? "Sua primeira extração é gratuita." : "Seu documento gratuito já foi utilizado."} Cada extração corresponde a um envio de arquivo; as partes do envio contam juntas.</DialogDescription>
   {data.testMode && <p className="rounded-lg border border-amber-300/40 bg-amber-950 p-3 text-sm text-amber-100">Modo de teste: nenhum pagamento real. Use somente cartões de teste da Stripe.</p>}
   {!data.testMode && data.paymentsAvailable === false && <p role="status" className="rounded-lg border border-amber-300/40 bg-amber-950 p-3 text-sm text-amber-100">Pagamentos temporariamente indisponíveis. Os planos serão liberados assim que a Stripe habilitar os recebimentos. Você pode entrar na conta e usar seu acesso gratuito ou saldo existente.</p>}
   {!data.loggedIn && <div className="grid gap-2 text-sm">{data.offers.map(offer=><p key={offer.kind}>{offer.kind==="subscription"?"Assinatura mensal":"Pacote avulso"}: {offer.tokens} tokens · {offer.amount !== null ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:offer.currency}).format(offer.amount/100):"Consultar"}</p>)}</div>}
   {!data.loggedIn && <div className="grid gap-2"><Button type="button" variant="outline" className="w-full border-slate-500 bg-white text-slate-950 hover:bg-slate-100 hover:text-slate-950" disabled={busy || !providers?.google} onClick={async () => { setBusy(true); setMessage(""); try { const {data: result,error}=await supabaseBrowser().auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/auth/callback",queryParams:{prompt:"select_account"}}}); if(error)throw error; if(!result.url)throw Error("Não foi possível abrir o Google."); }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível entrar com Google.");setBusy(false);} }}><span className="font-bold text-blue-600" aria-hidden="true">G</span> Entrar com Google</Button>{providers && !providers.google && <p className="text-xs text-muted-foreground">{providers.unavailable?"Login Google temporariamente indisponível. Use e-mail e senha.":"Login com Google em configuração. Use e-mail e senha por enquanto."}</p>}<p className="text-center text-xs text-muted-foreground">ou use seu e-mail</p></div>}
   {!data.loggedIn ? <form className="grid gap-3" onSubmit={async e => {
    e.preventDefault(); setBusy(true);setMessage("");
    try {
     const client = supabaseBrowser();
     const result = signup ? await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin + "/auth/callback"}}) : await client.auth.signInWithPassword({email,password});
     if(result.error) throw result.error;
     setPassword("");setMessage(signup && !result.data.session ? "Confira seu e-mail para confirmar o cadastro." : "Você entrou na sua conta.");
     if (result.data.session) window.location.reload();
     else await refresh();
    } catch(e) { setMessage(e instanceof Error ? e.message : "Não foi possível entrar"); } finally {setBusy(false);}
   }}><label className="text-sm">E-mail<input className="guide-input" autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label className="text-sm">Senha<input className="guide-input" autoComplete={signup?"new-password":"current-password"} type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label><Button disabled={busy}>{busy?<Loader2 className="animate-spin"/>:signup?"Criar conta":"Entrar"}</Button><button type="button" className="text-sm text-cyan-300" onClick={()=>setSignup(!signup)}>{signup?"Já tenho conta":"Criar uma conta"}</button></form> : <div className="grid gap-3">
    <p className="text-sm">{data.email}</p><p className="flex items-center gap-2 text-lime-300"><Coins size={18}/>{data.isAdmin ? "Acesso completo · sem cobrança por extração" : data.tokens + " tokens disponíveis" + (data.tokenCost ? " · " + data.tokenCost + " por extração" : "")}</p>
    {!data.isAdmin && data.offers.map(offer => <Button key={offer.kind} disabled={busy || data.paymentsAvailable === false} onClick={()=>void checkout(offer.kind)}>{offer.kind==="subscription"?"Assinar":"Comprar tokens"} · {offer.tokens} tokens · {offer.amount !== null ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:offer.currency}).format(offer.amount/100):"Consultar"}{offer.interval ? " / " + (offer.interval === "month" ? "mês" : offer.interval) : ""}</Button>)}
    <p className="text-xs text-muted-foreground">1 token por envio de arquivo, incluindo todas as partes. Tokens acumulam e não expiram. A assinatura renova mensalmente e pode ser cancelada pelo portal.</p>
    {!data.isAdmin && !data.offers.length && <p className="text-sm text-amber-200">Os planos estão sendo configurados. Pagamentos ainda indisponíveis.</p>}
    {data.canManage && <Button variant="outline" disabled={busy} onClick={()=>void checkout("portal")}>Gerenciar assinatura e pagamentos</Button>}
    <Button variant="ghost" disabled={busy} onClick={async()=>{await supabaseBrowser().auth.signOut(); window.location.reload();}}>Sair da conta</Button>
   </div>}
   {message && <p role="status" className="text-sm text-cyan-200">{message}</p>}
  </DialogContent></Dialog>
 </>;
}
