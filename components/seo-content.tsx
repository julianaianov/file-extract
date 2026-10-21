import Link from "next/link";
import { guides } from "@/lib/guides";
export function SeoContent() {
 return <section className="seo-content" aria-labelledby="seo-heading">
  <p className="section-kicker">ZIP, PDF E OCR ONLINE</p>
  <h2 id="seo-heading">Extraia arquivos e encontre o conteúdo que precisa</h2>
  <p>Abra arquivos ZIP, extraia texto de PDFs e encontre palavras nos documentos da sua biblioteca. O File Extract mostra duas linhas acima e abaixo de cada resultado e destaca a busca ao abrir o arquivo.</p>
  <div className="seo-guide-grid">{guides.map(guide => <article key={guide.slug}><h3><Link href={"/guias/" + guide.slug}>{guide.title}</Link></h3><p>{guide.description}</p><Link href={"/guias/" + guide.slug}>Ver o passo a passo →</Link></article>)}</div>
  <h2>Perguntas frequentes</h2>
  <details><summary>Posso enviar arquivos maiores que 4 MB?</summary><p>Sim. PDFs e ZIPs de até 50 MB são enviados em partes e remontados no servidor. O original é preservado, e as partes contam como um único envio.</p></details>
  <details><summary>Como funciona a extração gratuita?</summary><p>Você pode experimentar um envio gratuito de PDF ou ZIP. Para continuar depois disso, entre na sua conta e escolha uma assinatura ou pacote de tokens. Consulte os valores em Entrar / Planos.</p></details>
  <details><summary>A busca encontra palavras dentro dos arquivos?</summary><p>Sim, quando o conteúdo textual estiver disponível. Ela consulta nomes, texto extraído de PDFs, arquivos de texto, OCR já realizado e transcrições existentes, com trechos para entender o contexto.</p></details>
  <details><summary>O texto de uma imagem ou PDF digitalizado é lido automaticamente?</summary><p>O texto selecionável de PDFs é extraído no envio. Para imagens dentro de um ZIP, use Extrair texto para executar OCR. PDFs que contêm somente páginas digitalizadas não passam por OCR automático nesta versão.</p></details>
  <a className="seo-cta" href="#upload">Experimentar a ferramenta</a>
 </section>;
}
