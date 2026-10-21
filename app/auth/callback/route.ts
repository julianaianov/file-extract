import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
export async function GET(request: Request) {
 const url = new URL(request.url), code = url.searchParams.get("code");
 const response = new Response(null, { status: 303, headers: { Location: url.origin + "/" } });
 if (!code) return response;
 const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: {
  getAll: () => parseCookieHeader(request.headers.get("cookie") || "").map(c=>({name:c.name,value:c.value||""})),
  setAll: list => list.forEach(c=>response.headers.append("Set-Cookie",serializeCookieHeader(c.name,c.value,c.options))),
 }});
 const { error } = await client.auth.exchangeCodeForSession(code);
 if (error) response.headers.set("Location",url.origin+"/?auth=error");
 response.headers.set("Cache-Control","private, no-store");
 return response;
}
