import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
 if(process.env.VERCEL_ENV==="preview") return {rules:{userAgent:"*",disallow:"/"}};
 return {rules:{userAgent:"*",allow:"/",disallow:["/api/","/auth/"]},sitemap:siteUrl+"/sitemap.xml",host:siteUrl};
}
