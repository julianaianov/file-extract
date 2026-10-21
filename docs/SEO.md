# Busca do Google
A página inicial e os guias são renderizados em HTML no servidor. Títulos, descrições, URL canônica, Open Graph, dados estruturados WebApplication, robots.txt e sitemap.xml foram configurados.

URLs públicas:
- https://file-extract-ecru.vercel.app/
- https://file-extract-ecru.vercel.app/guias/extrair-arquivos-zip-online
- https://file-extract-ecru.vercel.app/guias/extrair-texto-pdf-online
- https://file-extract-ecru.vercel.app/guias/ocr-extrair-texto-imagem

A biblioteca é carregada por APIs vinculadas à conta, com noindex nas respostas das APIs e autenticação. Somente páginas públicas entram no sitemap. Previews da Vercel recebem noindex e bloqueio de rastreamento.

## Search Console
Entre no Google Search Console com a conta proprietária, adicione a propriedade de prefixo https://file-extract-ecru.vercel.app/ e escolha verificação por tag HTML. Adicione somente o valor de content da tag em GOOGLE_SITE_VERIFICATION na Vercel e publique novamente. Depois envie https://file-extract-ecru.vercel.app/sitemap.xml e solicite a inspeção da página inicial. A verificação depende do acesso à conta Google; não há token de verificação configurado neste projeto.

Não há garantia de posição nem de prazo para indexação. Acompanhe consultas e páginas indexadas no Search Console. Referência: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
