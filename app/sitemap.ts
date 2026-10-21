import type { MetadataRoute } from "next";
import { guides } from "@/lib/guides";
import { siteUrl } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
 return [{url:siteUrl},...guides.map(guide=>({url:siteUrl+"/guias/"+guide.slug}))];
}
