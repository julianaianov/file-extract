"use client";
import { useEffect,useId,useRef,useState } from "react";
import { Button } from "./ui/button";
type PaymentForm={mount:(selector:string)=>void;on:(event:"confirm",handler:(event:unknown)=>Promise<void>)=>void;destroy?:()=>void;unmount?:()=>void};
type Checkout={createForm:(options:{layout:"expanded"})=>PaymentForm;loadActions:()=>Promise<{type:string;actions?:{confirm:(options:{formConfirmEvent:unknown})=>Promise<{type?:string;error?:{message?:string}}|void>};error?:{message?:string}} >};
type StripeWindow=Window&{Stripe?:(key:string)=>{initCheckoutFormSdk:(options:{clientSecret:string;appearance:unknown})=>Checkout}};
const appearance={theme:"stripe",labels:"auto",inputs:"spaced",variables:{borderRadius:"4px",colorBackground:"#ffffff",colorDanger:"#df1b41",colorPrimary:"#0570de",colorSuccess:"#00c853",colorText:"#30313d",fontFamily:"default",fontSizeBase:"16px",spacingUnit:"4px"}};
let loader:Promise<void>|undefined;
function loadStripe(){
 if((window as StripeWindow).Stripe)return Promise.resolve();
 if(!loader)loader=new Promise<void>((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://js.stripe.com/dahlia/stripe.js";script.async=true;
  const timer=setTimeout(()=>{script.remove();reject(Error("O formulário demorou a carregar. Tente novamente."));},20000);
  script.onload=()=>{clearTimeout(timer);resolve();};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error("Não foi possível carregar o formulário seguro."));};
  document.head.appendChild(script);
 }).catch(error=>{loader=undefined;throw error;});
 return loader;
}
export function StripeCheckoutForm({clientSecret,onComplete,onCancel}:{clientSecret:string;onComplete:()=>void;onCancel:()=>void}){
 const id="checkout-form-"+useId().replace(/[^a-zA-Z0-9_-]/g,""),container=useRef<HTMLDivElement>(null),callbacks=useRef({onComplete,onCancel});
 callbacks.current={onComplete,onCancel};
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
  let cancelled=false,form:PaymentForm|undefined;
  (async()=>{
   const key=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
   if(!/^pk_(live|test)_/.test(key||""))throw Error("O pagamento está em configuração. Tente novamente mais tarde.");
   await loadStripe();if(cancelled)return;
   const create=(window as StripeWindow).Stripe;
   if(!create)throw Error("Serviço de pagamento indisponível.");
   const checkout=create(key!).initCheckoutFormSdk({clientSecret,appearance});
   form=checkout.createForm({layout:"expanded"});form.mount("#"+id);
   const result=await checkout.loadActions();if(cancelled)return;
   if(result.type!=="success"||!result.actions)throw Error(result.error?.message||"Não foi possível preparar o pagamento.");
   const actions=result.actions;
   form.on("confirm",async event=>{
    setError("");
    try{const confirmation=await actions.confirm({formConfirmEvent:event});if(confirmation?.type==="error")throw Error(confirmation.error?.message||"Não foi possível confirmar o pagamento.");if(!cancelled)callbacks.current.onComplete();}
    catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:"Falha ao confirmar o pagamento.");}
   });
   setLoading(false);
  })().catch(cause=>{if(!cancelled){setLoading(false);setError(cause instanceof Error?cause.message:"Pagamento indisponível.");}});
  return()=>{cancelled=true;if(form?.destroy)form.destroy();else form?.unmount?.();container.current?.replaceChildren();};
 },[clientSecret,id]);
 return <div className="space-y-3">{loading&&<p role="status" className="text-sm text-muted-foreground">Carregando pagamento seguro...</p>}<div ref={container} id={id} className="min-h-8 rounded bg-white"/>{error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}<Button variant="outline" onClick={()=>callbacks.current.onCancel()}>Voltar aos planos</Button></div>;
}
