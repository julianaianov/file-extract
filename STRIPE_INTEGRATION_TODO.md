# Integração Stripe e avisos administrativos

## Estado atual

O checkout hospedado de produção já funciona para tokens e assinatura. A migração para o formulário incorporado ainda depende das decisões e credenciais abaixo; os parâmetros novos ainda não foram aplicados à cobrança ativa.

## Values to Replace

Não há placeholders de preço ou modo na chamada existente. Os preços reais vêm de STRIPE_TOKEN_PRICE_ID e STRIPE_SUBSCRIPTION_PRICE_ID; mode já diferencia payment e subscription.

**Arquivos existentes:** [API de cobrança](app/api/billing/route.ts), [tela de conta](components/account-panel.tsx).

| Credencial ou decisão pendente | Ação |
|---|---|
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Configurar a chave pk_live_ de produção para o formulário no navegador. A chave secreta permanece apenas no servidor. |
| Vínculos customer e metadata | Confirmar se devem ser preservados, ou se o webhook também pode ser adaptado para vincular pagamentos sem esses campos. O webhook atual depende desses vínculos para conceder tokens. |
| RESEND_API_KEY e NOTIFICATION_FROM | Conectar uma chave própria do Resend e um remetente autorizado para enviar avisos a ADMIN_EMAIL. Nenhuma senha SMTP do Supabase foi copiada. |

## Configured Parameters

**Destino da alteração:** [API de cobrança](app/api/billing/route.ts). Valores solicitados no Checkout Studio, ainda pendentes de aplicação à integração ativa:

| Parâmetro | Valor solicitado |
|---|---|
| ui_mode | form |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| payment_method_collection | always, somente na assinatura |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |

O SDK instalado usa por padrão 2026-09-30.endive. Uma chamada isolada de teste com a versão 2026-03-25.dahlia confirmou ui_mode=form, client_secret preenchido e session.url nulo; a sessão foi encerrada sem pagamento. Uma segunda verificação com o Stripe.js real montou o formulário, carregou loadActions com sucesso e confirmou a existência das ações e métodos de limpeza, sem pagamento. O fluxo do componente foi testado com SDK simulado e a fila de e-mail com transporte simulado. A migração deve alinhar a versão e o cliente juntos. O código ativo não foi alterado apenas para passar nessa verificação.

## Setup and next steps

1. Resolver o vínculo de contas e fornecer a chave publicável de produção.
2. Alterar somente o necessário na chamada existente e no retorno/reuso de sessão para fornecer client_secret. Manter mode e preços reais; não inserir preços de exemplo.
3. O cliente já está preparado em [formulário incorporado](components/stripe-checkout-form.tsx) e [tela de conta](components/account-panel.tsx), aceitando client_secret sem redirecionamento. Ainda deve ser validado com o endpoint migrado e a chave publicável correta. Carregar Stripe.js diretamente de https://js.stripe.com/dahlia/stripe.js no head, montar o formulário e tratar confirmação e erros. Form não usa redirecionamento para session.url.
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
