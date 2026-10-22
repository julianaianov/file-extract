"use client";
import { useState } from "react";
import useSWR from "swr";
import { Bell, CheckCheck, UserRound, Coins, CreditCard } from "lucide-react";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
type Notice={id:number;kind:string;created_at:string;read_at:string|null;email_pending?:boolean;email_sent_at?:string|null;email_attempts?:number;email_error?:string|null;payload:{email?:string;tokens?:number;amount?:number;currency?:string}};
export function AdminNotifications(){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const {data,error,mutate}=useSWR<{notifications:Notice[];unread:number;emailConfigured?:boolean}>("/api/admin/notifications",async url=>{const r=await fetch(url);if(!r.ok)throw Error("Não foi possível carregar as notificações.");return r.json();},{refreshInterval:30000,revalidateOnFocus:true});
 const mark=async(id?:number)=>{setBusy(true);setMessage("");try{const r=await fetch("/api/admin/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})});if(!r.ok)throw Error("Não foi possível marcar como lida.");await mutate();}catch(e){setMessage(e instanceof Error?e.message:"Falha ao atualizar.");}finally{setBusy(false);}};
 return <><button className="guide-launch" onClick={()=>setOpen(true)} aria-label={"Notificações administrativas"+(data?.unread?", "+data.unread+" não lidas":"")}><Bell size={16}/>{!!data?.unread&&<span className="rounded-full bg-cyan-300 px-1.5 text-xs font-bold text-slate-950">{data.unread>99?"99+":data.unread}</span>}</button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="guide-dialog" overlayClassName="guide-overlay" style={{backgroundColor:"#101722",backgroundImage:"none",zIndex:101}}>
 <DialogTitle>Notificações administrativas</DialogTitle><DialogDescription>Novos usuários, compras de tokens e pagamentos de assinatura.</DialogDescription>
 {data?.emailConfigured===false && <p className="text-sm text-amber-200">Envio por e-mail em configuração. Todos os avisos permanecem disponíveis neste painel.</p>}
 {data?.unread ? <Button variant="outline" disabled={busy} onClick={()=>void mark()}><CheckCheck size={16}/>Marcar todas como lidas</Button>:null}
 <div className="max-h-[55vh] space-y-2 overflow-y-auto">
 {error ? <p role="alert">{error.message}</p>:!data?<p role="status">Carregando...</p>:!data.notifications.length?<p className="p-5 text-sm text-muted-foreground">As novas atividades aparecerão aqui.</p>:data.notifications.map(n=>{const Icon=n.kind==="user.created"?UserRound:n.kind==="tokens.purchased"?Coins:CreditCard;return <article key={n.id} className={"rounded-xl border p-3 "+(n.read_at?"border-border bg-slate-900":"border-cyan-300/40 bg-cyan-950/40")}><div className="flex items-center gap-2 text-sm font-semibold"><Icon size={17}/>{n.kind==="user.created"?"Novo usuário cadastrado":n.kind==="tokens.purchased"?"Compra de tokens confirmada":"Pagamento de assinatura confirmado"}</div>{n.payload.email&&<p className="mt-1 break-all text-sm text-cyan-200">{n.payload.email}</p>}{n.payload.tokens&&<p className="text-sm">{n.payload.tokens} tokens{n.payload.amount!=null&&n.payload.currency?" · "+new Intl.NumberFormat("pt-BR",{style:"currency",currency:n.payload.currency}).format(n.payload.amount/100):""}</p>}{n.email_sent_at&&<p className="mt-1 text-xs text-lime-300">E-mail enviado</p>}{n.email_pending&&<p className="mt-1 text-xs text-muted-foreground">{(n.email_attempts||0)>=8?"E-mail não enviado; verifique o serviço de envio.":"E-mail aguardando envio"}</p>}<div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><time>{new Date(n.created_at).toLocaleString("pt-BR")}</time>{!n.read_at&&<button className="text-cyan-300" disabled={busy} onClick={()=>void mark(n.id)}>Marcar como lida</button>}</div></article>;})}
 </div>{message&&<p role="status" className="text-sm text-amber-200">{message}</p>}
 </DialogContent></Dialog></>;
}
