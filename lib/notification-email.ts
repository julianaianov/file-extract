import { query } from "./postgres";
import { billingMode } from "./billing-mode";
type Notice={id:number;kind:string;payload:{email?:string;tokens?:number;amount?:number;currency?:string};created_at:string;email_attempts:number};
export function notificationEmailConfigured(){
 return !!(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM && process.env.ADMIN_EMAIL);
}
export function noticeEmail(notice: Notice){
 const title=notice.kind==="user.created"?"Novo usuário cadastrado":notice.kind==="tokens.purchased"?"Compra de tokens confirmada":"Pagamento de assinatura confirmado";
 const lines=["File Extract",title,""];
 if(notice.payload.email)lines.push("Usuário: "+String(notice.payload.email).slice(0,320));
 if(notice.payload.tokens)lines.push("Tokens: "+notice.payload.tokens);
 if(notice.payload.amount!=null && notice.payload.currency)lines.push("Valor: "+new Intl.NumberFormat("pt-BR",{style:"currency",currency:notice.payload.currency}).format(notice.payload.amount/100));
 lines.push("","Acesse o painel administrativo para consultar as notificações.","https://file-extract-ecru.vercel.app");
 return {subject:"File Extract — "+title,text:lines.join("\n")};
}
export async function deliverNotificationEmails(limit=3){
 if(!notificationEmailConfigured() || billingMode()!=="live")return {sent:0,failed:0,configured:notificationEmailConfigured()};
 const rows=(await query(`WITH candidates AS (
  SELECT id FROM public.admin_notifications
  WHERE email_pending AND email_sent_at IS NULL AND email_attempts<8
   AND email_available_at<=now() AND (email_lease_until IS NULL OR email_lease_until<now())
   AND (billing_mode IS NULL OR billing_mode='live')
  ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT $1
 ) UPDATE public.admin_notifications n SET email_lease_until=now()+interval '2 minutes',email_attempts=n.email_attempts+1
 FROM candidates c WHERE n.id=c.id RETURNING n.id,n.kind,n.payload,n.created_at,n.email_attempts`,[Math.max(1,Math.min(3,limit))])).rows as Notice[];
 let sent=0,failed=0;
 for(const notice of rows){
  try{
   const body=noticeEmail(notice);
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"file-extract-notification-"+notice.id},body:JSON.stringify({from:process.env.NOTIFICATION_FROM,to:[process.env.ADMIN_EMAIL],...body}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error("HTTP "+response.status);
   await query("UPDATE public.admin_notifications SET email_sent_at=now(),email_pending=false,email_lease_until=NULL,email_error=NULL WHERE id=$1",[notice.id]);
   sent++;
  }catch(error){
   failed++;
   const reason=error instanceof Error && /^HTTP \d{3}$/.test(error.message)?error.message:"Falha temporária no envio";
   await query("UPDATE public.admin_notifications SET email_lease_until=NULL,email_error=$2,email_available_at=now()+($3::integer*interval '1 second') WHERE id=$1",[notice.id,reason,Math.min(3600,30*2**notice.email_attempts)]);
  }
 }
 return {sent,failed,configured:true};
}
