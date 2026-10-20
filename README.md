# File Extract

Workspace para extrair arquivos ZIP, ler o texto de PDFs, pesquisar conteúdo, visualizar imagens e baixar arquivos. Os dados e os arquivos binários ficam no PostgreSQL do Supabase.

## Interface

Layout responsivo com navegação lateral no desktop, cores em ciano e verde-lima, efeitos em CSS e respeito à preferência de reduzir movimento. A biblioteca oferece grade/lista, seleção, paginação e filtros sincronizados. O envio mostra o progresso real da transferência.

Para reduzir tráfego, a listagem recebe apenas os metadados; o conteúdo completo é carregado ao abrir a pré-visualização. A busca espera 350 ms após a digitação e não há consultas periódicas quando o workspace está ocioso.

## Configuração

Use Node.js 24, como no projeto Vercel. Copie .env.example para .env.local e preencha:

- DATABASE_URL: URL do Transaction Pooler do Supabase, porta 6543. Codifique os caracteres especiais da senha.
- NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valores públicos do projeto Supabase.
- OCR_LANG: por+eng para imagens em português e inglês.
- OPENAI_API_KEY: opcional, necessária apenas para transcrição de áudio.

Em produção, o cache do OCR deve ficar em /tmp/tesseract-cache. O certificado raiz público do Supabase está incluído no código e a validação TLS permanece ativa.

Execute npm install, npm run db:setup e npm run dev. O schema também pode ser criado executando scripts/002-supabase.sql no SQL Editor. Os scripts SQL são idempotentes.

As mesmas variáveis devem estar configuradas nos ambientes desejados da Vercel. Depois de alterá-las, faça um novo deploy.

## Verificação

- npm run typecheck
- npm run build
- node scripts/check-upload.cjs: valida ZIP/PDF com armazenamento simulado.
- node scripts/check-supabase-upload.cjs: valida envio, texto e download no banco real; remove os próprios registros de teste.
- node scripts/check-vercel.cjs URL: valida a implantação pela CLI autenticada.
- node scripts/check-interface.cjs URL: testa desktop, celular, busca, filtros, paginação, modal e upload no navegador.
- node scripts/check-ocr.cjs URL: testa reconhecimento de texto de uma imagem e remove os próprios registros.

Os testes de navegador usam Microsoft Edge no Windows. As ferramentas de implantação requerem Vercel CLI instalada e autenticada. Capturas de tela, cookies e arquivos de ambiente ficam fora do Git.

## Limites

O envio aceita arquivos de até 4 MB para respeitar o limite de requisições da Vercel. ZIPs têm limite de 1.000 entradas e 100 MB descompactados. PDFs com camada de texto são pesquisáveis; PDFs digitalizados não recebem OCR automático. O OCR de imagens pode ser acionado na biblioteca.

O sistema não importa dados de um SQLite antigo automaticamente. As APIs mantêm o acesso compartilhado do aplicativo existente; não há autenticação por usuário implementada.
