const fs=require("fs"),{randomBytes}=require("crypto"),{spawnSync}=require("child_process"),{Client}=require("pg");
require("@next/env").loadEnvConfig(process.cwd());
for(const name of ["RESEND_API_KEY","NOTIFICATION_FROM","ADMIN_EMAIL","DATABASE_URL"])if(!process.env[name])throw Error("Configure "+name+" no .env.local");
if(!process.argv.includes("--apply-production")){console.log("Configuração local de e-mail encontrada. Use --apply-production para ativar a Vercel e o agendamento.");process.exit(0);}
(async()=>{
 let secret=process.env.NOTIFICATION_JOB_SECRET;
 if(!secret){secret=randomBytes(32).toString("hex");fs.appendFileSync(".env.local","\nNOTIFICATION_JOB_SECRET="+secret+"\n");}
 const cli=require("./vercel-cli.cjs"),values={RESEND_API_KEY:process.env.RESEND_API_KEY,NOTIFICATION_FROM:process.env.NOTIFICATION_FROM,NOTIFICATION_JOB_SECRET:secret};
 for(const [name,value]of Object.entries(values)){
  const r=spawnSync(process.execPath,[cli,"env","add",name,"--environment","production","--force","--yes",name==="NOTIFICATION_FROM"?"--no-sensitive":"--sensitive"],{input:value,encoding:"utf8",timeout:90000,windowsHide:true});
  if(r.status!==0)throw Error("Falha ao configurar "+name+" na Vercel");
  console.log("Vercel production:",name);
 }
 const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:20000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync("lib/supabase-ca.crt","utf8")}});
 try{
  await client.connect();await client.query("BEGIN");
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog");
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions");
  await client.query("CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault");
  const name="file_extract_notification_job_secret",row=(await client.query("SELECT id FROM vault.secrets WHERE name=$1",[name])).rows[0];
  if(row)await client.query("SELECT vault.update_secret($1,$2,$3,$4)",[row.id,secret,name,"File Extract notification worker authentication"]);
  else await client.query("SELECT vault.create_secret($1,$2,$3)",[secret,name,"File Extract notification worker authentication"]);
  const command="SELECT net.http_post(url := 'https://file-extract-ecru.vercel.app/api/admin/notifications/deliver', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='file_extract_notification_job_secret' LIMIT 1)), body := '{}'::jsonb, timeout_milliseconds := 45000)";
  await client.query("SELECT cron.schedule($1,$2,$3)",["file_extract_notification_email","* * * * *",command]);
  await client.query("COMMIT");console.log("Fila de e-mails agendada a cada minuto; segredo do job protegido no Supabase Vault. Publique a Vercel para aplicar as novas variáveis.");
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{await client.end();}
})().catch(e=>{console.error("Configuração de e-mail:",e.code||e.name);process.exitCode=1;});
