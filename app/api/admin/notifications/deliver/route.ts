import { timingSafeEqual } from "node:crypto";
import { deliverNotificationEmails } from "@/lib/notification-email";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
 const expected=process.env.NOTIFICATION_JOB_SECRET;
 const supplied=request.headers.get("authorization") || "";
 if(!expected || Buffer.byteLength(supplied)!==Buffer.byteLength("Bearer "+expected) || !timingSafeEqual(Buffer.from(supplied),Buffer.from("Bearer "+expected)))return Response.json({error:"Não autorizado"},{status:401,headers:{"Cache-Control":"no-store"}});
 try{return Response.json(await deliverNotificationEmails(),{headers:{"Cache-Control":"no-store"}});}
 catch{return Response.json({error:"Envio temporariamente indisponível"},{status:503});}
}
