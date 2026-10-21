# Login com Google
O botão usa Supabase Auth com PKCE. A sessão é criada no callback /auth/callback e o mesmo identificador de usuário participa da biblioteca, da gratuidade e dos créditos.

## Configuração externa necessária
O provedor Google estava desativado na verificação inicial. O código sozinho não cria um aplicativo OAuth na conta Google.

1. No Google Cloud Console, configure a tela de consentimento e crie um cliente OAuth do tipo Aplicativo da Web.
2. Origem JavaScript autorizada de produção: https://file-extract-ecru.vercel.app
3. URI de redirecionamento autorizada no Google: https://vycsqntraryuvioehptu.supabase.co/auth/v1/callback
4. No Supabase, Authentication → Sign In / Providers → Google, habilite o provedor e informe o Client ID e Client Secret.
5. Em Authentication → URL Configuration, use Site URL https://file-extract-ecru.vercel.app e inclua https://file-extract-ecru.vercel.app/auth/callback em Redirect URLs.
6. Para testar localmente, adicione http://localhost:3000 como origem no Google e http://localhost:3000/auth/callback como redirecionamento permitido no Supabase.
7. Enquanto a aplicação Google estiver em modo de teste, inclua os e-mails que poderão entrar como usuários de teste na tela de consentimento.
8. Depois de habilitar, atualize o site: o estado do botão é consultado no Supabase sem depender de nova publicação.

Alternativa para configuração via API: adicionar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e SUPABASE_ACCESS_TOKEN apenas ao .env.local. O Client Secret é enviado ao Supabase, não ao navegador nem ao Git. O token de gerenciamento serve para configurar o projeto e não é necessário no ambiente de execução da Vercel.

Erros ou cancelamentos retornam à tela de acesso com uma mensagem, sem exibir detalhes sensíveis. O teste com a conta Google real depende da configuração externa e da autenticação pelo titular.

Referência oficial: https://supabase.com/docs/guides/auth/social-login/auth-google

## Execucao automatica
Depois de preencher as tres variaveis locais, execute node scripts/configure-google-auth.cjs. O script habilita o provedor, ajusta Site URL e acrescenta o callback de producao sem remover os redirecionamentos existentes. Para conferir apenas a presenca das credenciais, use node scripts/configure-google-auth.cjs --check. O script nao cria o cliente OAuth no Google Cloud.
