# Cobrança e arquivos grandes

## Situação
O código suporta envio fragmentado de qualquer formato até 250 MB, login Supabase, um envio gratuito, compra de tokens e assinatura que concede tokens por fatura paga. BILLING_ENABLED ativa as contas e regras de acesso; a compra depende também de a Stripe liberar recebimentos. Oferta inicial escolhida: R$29,90 por mês com 100 tokens; pacote avulso de 20 tokens por R$14,90; 1 token por envio. Créditos acumulam sem expiração. Produção usa sua própria conta Stripe e carteira; desenvolvimento mantém a configuração de teste.

## Regras a definir antes da ativação
- Um documento corresponde a um envio de um arquivo; fragmentos e arquivos internos do ZIP não consomem créditos adicionais.
- Assinatura: R$29,90 mensais / 100 tokens por fatura paga.
- Pacote avulso: R$14,90 / 20 tokens. Custo: 1 token por envio.
- O código atual acumula os tokens concedidos a cada pagamento, sem expiração. O cancelamento da assinatura impede novas concessões; créditos existentes permanecem.
- A tentativa sem login usa um cookie HttpOnly e um registro no banco. Apagar cookies ou trocar de navegador permite outra identidade visitante. Identificação estrita da pessoa exige login antes do teste gratuito.
- Confirmar e atribuir os uploads anteriores a uma conta administradora antes de ativar: os registros antigos com owner_key nulo não ficam públicos no modo de contas.

## Configuração
1. Rodar npm run db:setup, incluindo scripts/003-accounts-billing.sql e scripts/004-large-files.sql.
2. Configurar Supabase Auth para permitir e-mail/senha e cadastrar o domínio de produção e /auth/callback nos URLs de redirecionamento. Configure SMTP para entrega dos e-mails de confirmação.
3. Usar uma chave Stripe de teste para validar. Criar um preço de compra única e um preço recorrente. Os valores exibidos vêm da Stripe.
4. Configurar as variáveis privadas no servidor e na Vercel:
   - BILLING_ENABLED=true (somente ao concluir configuração e testes)
   - APP_URL=https://file-extract-ecru.vercel.app
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - STRIPE_TOKEN_PRICE_ID
   - STRIPE_TOKEN_PACK_SIZE
   - STRIPE_SUBSCRIPTION_PRICE_ID
   - STRIPE_SUBSCRIPTION_TOKENS
   - STRIPE_PORTAL_CONFIGURATION_ID
   - ADMIN_EMAIL (ianov.technology@gmail.com, deve confirmar o e-mail no Supabase)
   - EXTRACTION_TOKEN_COST
5. Criar webhook /api/billing/webhook com eventos checkout.session.completed, checkout.session.async_payment_succeeded e invoice.paid. Créditos são concedidos somente após pagamento confirmado; eventos duplicados não repetem a concessão.
6. Configurar o Customer Portal na Stripe para o cliente gerenciar pagamentos e cancelamento. Não habilitar troca de produtos pelo portal sem mapear os respectivos pacotes de tokens.
7. Validar com checkout de teste, fatura inicial, renovação, cancelamento e pagamento recusado antes de trocar para chaves de produção. Não usar cartões reais nos testes.
8. Reembolsos e disputas precisam ser acompanhados no painel Stripe; esta versão não retira automaticamente tokens já concedidos em caso de estorno financeiro.

## Limites técnicos
As partes têm no máximo 3 MB e expiram após uma hora. A primeira parte inicia uma sessão vinculada ao visitante/conta. No máximo dois envios podem estar pendentes por identidade. Repetir uma parte substitui a mesma parte; repetir a finalização concluída retorna o resultado anterior. Falhas de extração devolvem a reserva de gratuidade/tokens. O limite de descompactação é de 1000 arquivos e 250 MB. O processamento deve caber no tempo da função Vercel (60 segundos para envio direto e 300 segundos para finalizar envios em partes); processamento de documentos muito complexos pode exigir uma fila com worker.

Os áudios e downloads aceitam leitura parcial. O botão de download monta partes no navegador para contornar o limite de resposta da Vercel. Os arquivos originais permanecem íntegros.

Uma função interrompida abruptamente pode deixar uma sessão em processamento. Reservas com mais de dez minutos são reconciliadas na consulta de conta ou antes da próxima extração: uploads completos mantêm a cobrança; tentativas incompletas devolvem o uso. A sessão antiga expira após uma hora. Recomenda-se monitorar falhas e acrescentar uma rotina periódica quando o volume crescer.

## Verificação
- scripts/check-chunks-billing.cjs: bytes originais de PDF maior que 4 MB, isolamento, envio incompleto, finalização repetida, limite gratuito concorrente e webhook assinado com eventos repetidos.
- scripts/check-large-formats.cjs: formatos arbitrários e 51 MB em partes, bytes integrais e downloads entre limites de partes; --quick testa a finalização com 5 MB.
- scripts/check-audio-stream.cjs: intervalos de áudio.
- scripts/check-interface.cjs: interface, busca e tutorial.

Envios aceitam qualquer extensão até 250 MB. Arquivos maiores que 4 MB usam partes de 3 MB; as partes não geram cobranças adicionais. O armazenamento segmentado requer scripts/004-large-files.sql. ZIPs mantêm o limite de 1000 itens e 250 MB descompactados. Formatos sem leitor são preservados para download. A biblioteca abre por envio e os filtros mostram somente seus itens.

## Produção
Aplique scripts/005-live-billing.sql antes de publicar. A carteira de teste permanece em token_balance/stripe_customer_id; a carteira real começa em live_token_balance/live_stripe_customer_id. Reservas, pedidos e concessões registram billing_mode. Estornos usam o ambiente da reserva original. O webhook rejeita eventos de ambiente diferente do servidor. A gratuidade continua única por identidade.

Configure STRIPE_LIVE_SECRET_KEY apenas no .env.local e execute node scripts/configure-live-billing.cjs para preparar os preços, webhook e portal. A configuração privada fica em .vercel/live-billing.production.json, ignorada pelo Git. O argumento --apply-production envia apenas à Vercel Production, preservando Preview e desenvolvimento. Publique após a migração. Checkout hospedado usa a chave secreta no servidor e não exige chave publicável no navegador.

A verificação de produção confirmou recebimentos habilitados na conta configurada. Se charges_enabled deixar de ser true, o catálogo aparece com aviso e a compra fica indisponível. O servidor verifica esse estado com cache de 60 segundos. Após a liberação pela Stripe, uma nova consulta de conta libera os botões sem novo deploy. O portal de um cliente real existente continua acessível para cancelamentos, mesmo se novas compras estiverem bloqueadas.

Verificação: scripts/check-billing-mode.cjs testa carteiras separadas, estornos entre ambientes, reconciliação, eventos assinados sem duplicação e disponibilidade. Nenhum teste faz cobrança real.

## Administrador e notificações
ADMIN_EMAIL define o e-mail administrativo. Somente uma sessão validada pelo Supabase com e-mail confirmado recebe a isenção de extrações. O saldo e a gratuidade não são consumidos; os limites técnicos de arquivo continuam valendo. O acesso aos documentos continua vinculado ao workspace da conta.

Aplique scripts/006-admin-notifications.sql: novos cadastros geram avisos por gatilho em auth.users. Webhooks de compras e assinaturas confirmadas geram avisos na mesma transação da concessão de tokens, sem duplicação. A API /api/admin/notifications exige administrador confirmado, verifica a origem para marcar leituras e mostra o ambiente atual. O sino consulta novos avisos a cada 30 segundos e ao retornar à janela. Avisos de e-mail dependem de conectar um serviço de envio; o painel funciona sem SMTP.
