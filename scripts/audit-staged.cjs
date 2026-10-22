const fs=require("fs"),{execFileSync}=require("child_process");
const git=(...args)=>execFileSync("git",["-c","safe.directory="+process.cwd().replaceAll("\\","/"),...args],{encoding:"utf8",maxBuffer:20*1024*1024});
const files=git("diff","--cached","--name-only","--diff-filter=ACMR").trim().split(/\r?\n/).filter(Boolean);
const env=fs.existsSync(".env.local")?fs.readFileSync(".env.local","utf8"):"";
const secrets=env.split(/\r?\n/).filter(line=>/^(DATABASE_URL|OPENAI_API_KEY|VERCEL_OIDC_TOKEN|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_LIVE_SECRET_KEY|RESEND_API_KEY|NOTIFICATION_JOB_SECRET|SMTP_PASS|STRIPE_WEBHOOK_SECRET|STRIPE_RESTRICTED_KEY|STRIPE_SETUP_SECRET_KEY|GOOGLE_CLIENT_SECRET|SUPABASE_ACCESS_TOKEN)=/.test(line)).map(line=>line.slice(line.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")).filter(value=>value.length>8);
const connection=secrets.find(value=>value.startsWith("postgresql://"));
if(connection){try{const password=decodeURIComponent(new URL(connection).password);if(password.length>=8)secrets.push(password)}catch{}}
const failures=[];
for(const file of files){
if((/^\.env(?:\.|$)/.test(file)&&file!==".env.example")||file.startsWith(".vercel/")||file.startsWith("artifacts/")){failures.push(file);continue}
const content=git("show",":"+file);
if(secrets.some(secret=>content.includes(secret))||/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b|\bwhsec_[A-Za-z0-9]{24,}\b/.test(content)||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))failures.push(file);
}
if(failures.length){console.error("Arquivos bloqueados na auditoria:",failures.join(", "));process.exit(1)}
console.log("PASS auditoria: "+files.length+" arquivos preparados; credenciais e artefatos locais fora do commit.");
