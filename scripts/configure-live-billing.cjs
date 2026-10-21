const fs=require("fs"),{spawnSync}=require("child_process"),Stripe=require("stripe");
require("@next/env").loadEnvConfig(process.cwd());
const file=".vercel/live-billing.production.json", appUrl="https://file-extract-ecru.vercel.app";
const key=process.env.STRIPE_LIVE_SECRET_KEY;
if(!/^sk_live_/.test(key||""))throw Error("Configure STRIPE_LIVE_SECRET_KEY no .env.local");
const stripe=new Stripe(key,{timeout:20000,maxNetworkRetries:1}),metadata={app:"file-extract",environment:"live",version:"1"};
(async()=>{
 const account=await stripe.accounts.retrieve();
 let saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):{};
 if(saved.account && saved.account!==account.id)throw Error("Conta Stripe diferente da configuração salva");
 saved.account=account.id;saved.STRIPE_ACCOUNT_ID=account.id;
 const persist=()=>{fs.mkdirSync(".vercel",{recursive:true});fs.writeFileSync(file,JSON.stringify(saved,null,2)+"\n");};
 const products=(await stripe.products.list({limit:100})).data;
 const price=async(kind,tokens,amount,recurring)=>{
  const lookup="file_extract_live_"+kind+"_brl_v1";
  const prices=await stripe.prices.list({lookup_keys:[lookup],limit:1});
  if(prices.data[0]){
   const p=prices.data[0];
   if(!p.active||!p.livemode||p.unit_amount!==amount||p.currency!=="brl"||Boolean(p.recurring)!==recurring)throw Error("Preço existente incompatível: "+kind);
   return p.id;
  }
  let product=products.find(p=>p.metadata.app==="file-extract"&&p.metadata.kind===kind);
  if(!product)product=await stripe.products.create({name:recurring?"File Extract Mensal — 100 tokens":"File Extract — 20 tokens",description:tokens+" tokens para extrações. Cada envio custa 1 token; partes não custam tokens adicionais.",metadata:{...metadata,kind}},{idempotencyKey:account.id+":"+lookup+":product"});
  const created=await stripe.prices.create({product:product.id,currency:"brl",unit_amount:amount,lookup_key:lookup,...(recurring?{recurring:{interval:"month"}}:{}),metadata},{idempotencyKey:account.id+":"+lookup+":price"});
  return created.id;
 };
 saved.STRIPE_TOKEN_PRICE_ID=await price("tokens20",20,1490,false);persist();
 saved.STRIPE_SUBSCRIPTION_PRICE_ID=await price("monthly100",100,2990,true);persist();
 const endpoints=(await stripe.webhookEndpoints.list({limit:100})).data;
 const existing=endpoints.find(e=>e.metadata.app==="file-extract"&&e.metadata.environment==="live"&&e.url===appUrl+"/api/billing/webhook");
 if(existing){
  if(saved.webhookId!==existing.id||!saved.STRIPE_WEBHOOK_SECRET)throw Error("Webhook já existe; adicione seu segredo ao arquivo local de configuração antes de prosseguir");
 }else{
  const endpoint=await stripe.webhookEndpoints.create({url:appUrl+"/api/billing/webhook",api_version:stripe.getApiField("version"),enabled_events:["checkout.session.completed","checkout.session.async_payment_succeeded","invoice.paid"],description:"File Extract produção",metadata},{idempotencyKey:account.id+":file-extract:live-webhook:v1"});
  saved.webhookId=endpoint.id;saved.STRIPE_WEBHOOK_SECRET=endpoint.secret;persist();
 }
 const portals=(await stripe.billingPortal.configurations.list({limit:100})).data;
 let portal=portals.find(p=>p.active&&p.metadata.app==="file-extract"&&p.metadata.environment==="live");
 if(!portal)portal=await stripe.billingPortal.configurations.create({business_profile:{headline:"File Extract — sua conta e pagamentos"},default_return_url:appUrl,features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:"at_period_end"}},metadata},{idempotencyKey:account.id+":file-extract:live-portal:v1"});
 saved.STRIPE_PORTAL_CONFIGURATION_ID=portal.id;
 Object.assign(saved,{STRIPE_TOKEN_PACK_SIZE:"20",STRIPE_SUBSCRIPTION_TOKENS:"100",EXTRACTION_TOKEN_COST:"1",APP_URL:appUrl,BILLING_ENABLED:"true"});persist();
 console.log("Stripe de produção preparada:",JSON.stringify({account:account.id,chargesEnabled:account.charges_enabled,payoutsEnabled:account.payouts_enabled,pack:"BRL 14.90 / 20 tokens",subscription:"BRL 29.90 / mês / 100 tokens",webhook:saved.webhookId,portal:portal.id}));
 if(process.argv.includes("--apply-production")){
  const cli=require("./vercel-cli.cjs"),values={...saved,STRIPE_SECRET_KEY:key};
  for(const name of ["STRIPE_ACCOUNT_ID","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","STRIPE_TOKEN_PRICE_ID","STRIPE_SUBSCRIPTION_PRICE_ID","STRIPE_PORTAL_CONFIGURATION_ID","STRIPE_TOKEN_PACK_SIZE","STRIPE_SUBSCRIPTION_TOKENS","EXTRACTION_TOKEN_COST","APP_URL","BILLING_ENABLED"]){
   const r=spawnSync(process.execPath,[cli,"env","add",name,"--environment","production","--force","--yes",["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"].includes(name)?"--sensitive":"--no-sensitive"],{input:values[name],encoding:"utf8",timeout:90000,windowsHide:true});
   if(r.status!==0)throw Error("Não foi possível configurar "+name+" na Vercel");
   console.log("Vercel production:",name);
  }
 }
})().catch(e=>{console.error("Configuração Stripe:",e.code||e.type||"erro",String(e.message).replace(/(?:sk|rk)_(?:live|test)_\w+|whsec_\w+/g,"[redacted]"));process.exitCode=1;});
