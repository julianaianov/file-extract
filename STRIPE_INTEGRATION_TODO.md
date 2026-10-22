# Integração Stripe e avisos administrativos

## Estado atual

A API e a interface suportam o formulário incorporado com client_secret. customer, metadata e subscription_data.metadata foram preservados conforme autorizado, mantendo a entrega de tokens pelo webhook. O formulário é ativado quando a chave publicável corresponde ao modo da chave secreta. A chave publicável live foi configurada na Vercel em 21/10/2026. O Stripe.js real carregou as ações do formulário com sucesso usando a chave de produção; a sessão de verificação foi encerrada sem pagamento.

## Values to Replace

Não há placeholders de preço ou modo na chamada existente. Os preços reais vêm de STRIPE_TOKEN_PRICE_ID e STRIPE_SUBSCRIPTION_PRICE_ID; mode já diferencia payment e subscription.

**Arquivos existentes:** [API de cobrança](app/api/billing/route.ts), [tela de conta](components/account-panel.tsx).

| Credencial ou decisão pendente | Ação |
|---|---|
| RESEND_API_KEY e NOTIFICATION_FROM | Conectar uma chave própria do Resend e um remetente autorizado para enviar avisos a ADMIN_EMAIL. Nenhuma senha SMTP do Supabase foi copiada. |

## Configured Parameters

**Destino da alteração:** [API de cobrança](app/api/billing/route.ts). Valores aplicados às sessões de formulário incorporado:

| Parâmetro | Valor |
|---|---|
| ui_mode | form |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| payment_method_collection | always, somente na assinatura |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |

O SDK instalado usa por padrão 2026-09-30.endive. Uma chamada isolada de teste com a versão 2026-03-25.dahlia confirmou ui_mode=form, client_secret preenchido e session.url nulo; a sessão foi encerrada sem pagamento. Uma segunda verificação com o Stripe.js real montou o formulário, carregou loadActions com sucesso e confirmou a existência das ações e métodos de limpeza, sem pagamento. O fluxo do componente foi testado com SDK simulado e a fila de e-mail com transporte simulado. As chamadas de criação e leitura do formulário usam explicitamente 2026-03-25.dahlia junto ao Stripe.js Dahlia, sem alterar a versão das demais operações financeiras.

## Setup and next steps

1. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY já está configurada com a chave live na Vercel. O ambiente local mantém a chave test para desenvolvimento. Ao trocar as chaves no futuro, manter pública e secreta na mesma conta e modo e republicar.
2. O endpoint retorna client_secret para sessões form e reutiliza sessões de assinatura compatíveis. mode, preços reais e vínculos de cobrança foram preservados.
3. O cliente já está preparado em [formulário incorporado](components/stripe-checkout-form.tsx) e [tela de conta](components/account-panel.tsx), aceitando client_secret sem redirecionamento. A chave live foi validada com uma sessão de produção e Stripe.js real, sem pagamento. Carregar Stripe.js diretamente de https://js.stripe.com/dahlia/stripe.js no head, montar o formulário e tratar confirmação e erros. Form não usa redirecionamento para session.url.
4. Manter concessões idempotentes de tokens pelo webhook e notificações após pagamentos confirmados.
5. Para e-mails: executar npm run db:setup, configurar RESEND_API_KEY e NOTIFICATION_FROM no .env.local, então node scripts/configure-notification-email.cjs --apply-production e publicar. O script gera a autenticação do job, protege-a no Supabase Vault e agenda a fila a cada minuto.
6. Validar o formulário com chaves de teste e o cartão de teste 4242 4242 4242 4242, validade futura e CVC de teste. Nunca usar cartões de teste em produção. Depois validar a configuração live sem efetuar pagamentos de teste com cartões reais.

### Arquivos de e-mail

- [Fila e tentativas de envio](lib/notification-email.ts)
- [Endpoint autenticado do worker](app/api/admin/notifications/deliver/route.ts)
- [Migração da fila](scripts/007-notification-email.sql)
- [Configuração da Vercel e agendamento](scripts/configure-notification-email.cjs)

Novos avisos ficam no painel e na fila. Registros antigos permanecem apenas no painel. Falhas do provedor são reagendadas; a entrega não altera saldos nem a confirmação financeira. O serviço ainda não envia e-mails sem a credencial e o remetente autorizados.

Recursos: https://support.stripe.com · https://docs.stripe.com/mcp · https://resend.com/docs

## Capacidade e custo

O envio do original não tem mais o teto fixo de 250 MB. A cobrança utiliza blocos iniciados de 250 MB e o custo é mostrado antes do envio. Primeiro documento e administrador continuam com suas isenções. Consulte [capacidade e limites de extração](CAPACIDADE.md). Arquivos PDF/ZIP acima da capacidade automática são guardados com aviso explícito, sem declarar extração do conteúdo.
