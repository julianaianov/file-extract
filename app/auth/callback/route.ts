import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
export async function GET(request: Request) {
 const url = new URL(request.url), code = url.searchParams.get("code");
 const response = new Response(null, { status: 303, headers: { Location: url.origin + "/", "Cache-Control": "private, no-store" } });
 if (url.searchParams.has("error") || !code) { response.headers.set("Location", url.origin + "/?auth=error"); return response; }
 try {
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: {
   getAll: () => parseCookieHeader(request.headers.get("cookie") || "").map(cookie => ({name:cookie.name,value:cookie.value || ""})),
   setAll: list => list.forEach(cookie => response.headers.append("Set-Cookie",serializeCookieHeader(cookie.name,cookie.value,cookie.options))),
  }});
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) response.headers.set("Location", url.origin + "/?auth=error");
 } catch { response.headers.set("Location", url.origin + "/?auth=error"); }
 return response;
}
