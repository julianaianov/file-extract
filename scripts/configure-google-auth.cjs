require("@next/env").loadEnvConfig(process.cwd());
const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SUPABASE_ACCESS_TOKEN"];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
 console.error("Credenciais ausentes no .env.local: " + missing.join(", "));
 process.exitCode = 2;
} else if (process.argv.includes("--check")) {
 console.log("Credenciais presentes; nenhuma configuração remota foi alterada.");
} else {
 (async () => {
  const project = "vycsqntraryuvioehptu", site = "https://file-extract-ecru.vercel.app";
  const endpoint = "https://api.supabase.com/v1/projects/" + project + "/config/auth";
  const headers = { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN, "Content-Type": "application/json" };
  const currentResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20000) });
  if (!currentResponse.ok) throw new Error("Não foi possível ler a configuração do projeto. HTTP " + currentResponse.status + ". Verifique o acesso do token ao projeto.");
  const current = await currentResponse.json();
  const redirects = new Set((current.uri_allow_list || "").split(",").map(value => value.trim()).filter(Boolean));
  redirects.add(site + "/auth/callback");
  const response = await fetch(endpoint, {
   method: "PATCH", headers, signal: AbortSignal.timeout(20000),
   body: JSON.stringify({
    external_google_enabled: true,
    external_google_client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    external_google_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
    site_url: site,
    uri_allow_list: [...redirects].join(","),
   }),
  });
  if (!response.ok) throw new Error("Não foi possível ativar Google. HTTP " + response.status + ". Verifique as permissões de configuração de Auth.");
  for (let attempt = 0; attempt < 6; attempt++) {
   const settings = await fetch("https://" + project + ".supabase.co/auth/v1/settings", {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(10000), cache: "no-store",
   });
   if (settings.ok && (await settings.json()).external?.google === true) {
    console.log("Google habilitado no Supabase; Site URL e retorno de produção configurados.");
    console.log("O Client Secret ficou apenas no Supabase. Nenhuma credencial foi enviada à Vercel ou ao Git.");
    console.log("O login real ainda requer que o cliente OAuth no Google autorize https://" + project + ".supabase.co/auth/v1/callback.");
    return;
   }
   await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("Configuração enviada, mas o provedor ainda não confirmou a ativação. Confira o painel Supabase antes de repetir.");
 })().catch(error => { console.error(error.name === "Error" ? error.message : "Falha de conexão ao configurar o provedor."); process.exitCode = 1; });
}
