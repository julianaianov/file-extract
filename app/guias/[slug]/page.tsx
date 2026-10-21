import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { guides } from "@/lib/guides";
import { siteUrl } from "@/lib/site";
export function generateStaticParams() { return guides.map(guide => ({slug:guide.slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> {
 const {slug}=await params, guide=guides.find(item=>item.slug===slug);
 if(!guide) return {};
 return {title:guide.title,description:guide.description,alternates:{canonical:siteUrl+"/guias/"+guide.slug},openGraph:{title:guide.title,description:guide.description,url:siteUrl+"/guias/"+guide.slug}};
}
export default async function Guide({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params, guide=guides.find(item=>item.slug===slug);
 if(!guide) notFound();
 return <main className="public-guide"><nav aria-label="Navegação do guia"><Link href="/">File Extract</Link><span> / Guias</span></nav><article><p className="section-kicker">GUIA PRÁTICO</p><h1>{guide.title}</h1><p className="guide-lead">{guide.intro}</p><h2>Passo a passo</h2><ol>{guide.steps.map(step=><li key={step}>{step}</li>)}</ol>{guide.sections.map(section=><section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}<Link className="seo-cta" href="/#upload">Abrir a ferramenta e enviar um arquivo</Link></article><aside><h2>Continue explorando</h2>{guides.filter(item=>item.slug!==guide.slug).map(item=><Link key={item.slug} href={"/guias/"+item.slug}>{item.title} →</Link>)}</aside></main>;
}
