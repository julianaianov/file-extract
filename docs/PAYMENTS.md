# Cobrança e arquivos grandes

## Situação
O código suporta envio fragmentado de PDFs/ZIPs até 50 MB, login Supabase, um envio gratuito, compra de tokens e assinatura que concede tokens por fatura paga. A cobrança fica desligada enquanto BILLING_ENABLED não for true. Oferta inicial escolhida: R$29,90 por mês com 100 tokens; pacote avulso de 20 tokens por R$14,90; 1 token por envio. Créditos acumulam sem expiração. Stripe configurada em modo de teste.

## Regras a definir antes da ativação
- Um documento corresponde a um envio (PDF/ZIP); fragmentos e arquivos internos do ZIP não consomem créditos adicionais.
- Assinatura: R$29,90 mensais / 100 tokens por fatura paga.
- Pacote avulso: R$14,90 / 20 tokens. Custo: 1 token por envio.
- O código atual acumula os tokens concedidos a cada pagamento, sem expiração. O cancelamento da assinatura impede novas concessões; créditos existentes permanecem.
- A tentativa sem login usa um cookie HttpOnly e um registro no banco. Apagar cookies ou trocar de navegador permite outra identidade visitante. Identificação estrita da pessoa exige login antes do teste gratuito.
- Confirmar e atribuir os uploads anteriores a uma conta administradora antes de ativar: os registros antigos com owner_key nulo não ficam públicos no modo de contas.

## Configuração
1. Rodar npm run db:setup, incluindo scripts/003-accounts-billing.sql.
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
As partes têm no máximo 3 MB e expiram após uma hora. A primeira parte inicia uma sessão vinculada ao visitante/conta. No máximo dois envios podem estar pendentes por identidade. Repetir uma parte substitui a mesma parte; repetir a finalização concluída retorna o resultado anterior. Falhas de extração devolvem a reserva de gratuidade/tokens. O limite de descompactação continua 1000 arquivos e 100 MB. O processamento deve caber no tempo da função Vercel (60 segundos); processamento de documentos muito complexos pode exigir uma fila com worker.

Os áudios e downloads aceitam leitura parcial. O botão de download monta partes no navegador para contornar o limite de resposta da Vercel. Os arquivos originais permanecem íntegros.

Uma função interrompida abruptamente pode deixar uma sessão em processamento. Reservas com mais de dez minutos são reconciliadas na consulta de conta ou antes da próxima extração: uploads completos mantêm a cobrança; tentativas incompletas devolvem o uso. A sessão antiga expira após uma hora. Recomenda-se monitorar falhas e acrescentar uma rotina periódica quando o volume crescer.

## Verificação
- scripts/check-chunks-billing.cjs: bytes originais de PDF maior que 4 MB, isolamento, envio incompleto, finalização repetida, limite gratuito concorrente e webhook assinado com eventos repetidos.
- scripts/check-audio-stream.cjs: intervalos de áudio.
- scripts/check-interface.cjs: interface, busca e tutorial.
