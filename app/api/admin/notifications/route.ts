import { withWorkspace } from "@/lib/workspace";
import { isAdministrator } from "@/lib/administrator";
import { billingMode } from "@/lib/billing-mode";
import { query } from "@/lib/postgres";
export const runtime="nodejs";
export const GET=withWorkspace(async()=>{
 if(!isAdministrator())return Response.json({error:"Acesso restrito à administração"},{status:403});
 const notifications=(await query("SELECT id,kind,payload,created_at,read_at FROM public.admin_notifications WHERE billing_mode IS NULL OR billing_mode=$1 ORDER BY created_at DESC,id DESC LIMIT 50",[billingMode()])).rows;
 const unread=(await query("SELECT count(*)::int AS count FROM public.admin_notifications WHERE read_at IS NULL AND (billing_mode IS NULL OR billing_mode=$1)",[billingMode()])).rows[0].count;
 return Response.json({notifications,unread});
});
export const POST=withWorkspace(async(request)=>{
 if(!isAdministrator())return Response.json({error:"Acesso restrito à administração"},{status:403});
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Origem inválida"},{status:403});
 const input=await request.json();
 if(input.all!==true && (!Number.isSafeInteger(input.id)||input.id<1))return Response.json({error:"Notificação inválida"},{status:400});
 await query("UPDATE public.admin_notifications SET read_at=now() WHERE read_at IS NULL AND (billing_mode IS NULL OR billing_mode=$1) AND ($2::bigint IS NULL OR id=$2)",[billingMode(),input.all===true?null:input.id]);
 return Response.json({success:true});
});
