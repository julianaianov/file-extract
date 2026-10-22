# Capacidade de arquivos

O teto de 250 MB foi removido para envio e download do original. A transferência utiliza partes de 3 MB. Tamanhos são armazenados em bigint; o sistema aceita tamanhos inteiros representáveis pelo navegador, sujeitos ao espaço, à rede e à disponibilidade do Supabase. Não há promessa de capacidade física ilimitada.

A extração automática de PDFs e ZIPs continua limitada a 250 MB de entrada. ZIPs também mantêm a proteção de 1000 itens e 250 MB descompactados. Acima do limite de extração, o original é preservado e o aviso aparece antes do envio e na biblioteca; não se informa que o conteúdo foi extraído. Textos têm prévia e busca limitadas ao primeiro milhão de caracteres. Outros formatos são guardados integralmente; a capacidade de prévia depende do tipo.

Para remover também o limite de extração, será necessário um serviço de processamento com fila e recursos dimensionados para documentos grandes. A atual função serverless não fornece isso.

## Tokens

O custo é o valor de EXTRACTION_TOKEN_COST por bloco iniciado de 250 MB do original. Com valor 1: 250 MB = 1 token; 251 MB = 2 tokens; 1 GB = 5 tokens. O custo é informado antes do envio, verificado no servidor e reservado ao processar. Falhas devolvem a reserva. O primeiro documento continua gratuito; o administrador confirmado permanece isento.

A cobrança corresponde à importação do original, inclusive quando o usuário escolhe salvar um documento acima da capacidade de extração após ler o aviso. Partes de transferência não são cobradas separadamente.

## Download e envio prolongado

Navegadores com seleção de destino gravam cada parte diretamente no arquivo em disco. Nos demais navegadores com Service Worker, o download é transmitido ao gerenciador do navegador através de /downloads/, buscando partes autenticadas. Navegadores antigos sem esses recursos usam o download por Blob e podem depender da memória disponível.

Cada parte recebida renova a validade do envio por 24 horas. A finalização consulta apenas os bytes necessários à prévia e move o original no banco, sem remontá-lo na memória da aplicação quando o processamento não exige isso.

## Instalação e validação

Executar npm run db:setup para aplicar [a migração](scripts/008-flexible-capacity.sql), antes de publicar o código.

- node scripts/check-flexible-capacity.cjs: simulações de 251 MB e 5 GB, sem conexão externa e sem criação de arquivos grandes.
- node scripts/check-download-capacity.cjs: escrita incremental em disco, transmissão pelo Service Worker e integridade de ranges.
- node scripts/check-large-formats.cjs --quick: formatos e transferência em partes.
