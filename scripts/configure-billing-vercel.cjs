require("@next/env").loadEnvConfig(process.cwd());
const {spawnSync}=require("child_process"), cli=require("./vercel-cli.cjs");
for(const name of ["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","STRIPE_TOKEN_PRICE_ID","STRIPE_TOKEN_PACK_SIZE","STRIPE_SUBSCRIPTION_PRICE_ID","STRIPE_SUBSCRIPTION_TOKENS","STRIPE_PORTAL_CONFIGURATION_ID","EXTRACTION_TOKEN_COST","APP_URL","ADMIN_EMAIL","BILLING_ENABLED","NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
 const value=process.env[name];if(!value)throw Error("Variável ausente: "+name);
 const secret=["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"].includes(name);
 const r=spawnSync(process.execPath,[cli,"env","add",name,"--environment","production,preview","--force","--yes",secret?"--sensitive":"--no-sensitive"],{input:value,encoding:"utf8",timeout:90000,windowsHide:true});
 if(r.status!==0){console.error("Falha ao configurar "+name+"; verifique a sessão Vercel.");process.exit(1);}
 console.log("Configurada:",name);
}
