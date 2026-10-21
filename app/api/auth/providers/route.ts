export const runtime = "nodejs";
export async function GET() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) return Response.json({ google: false }, { headers: { "Cache-Control": "no-store" } });
 try {
  const response = await fetch(url + "/auth/v1/settings", { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Provedores indisponíveis");
  const settings = await response.json();
  return Response.json({ google: settings.external?.google === true }, { headers: { "Cache-Control": "private, no-store" } });
 } catch { return Response.json({ google: false, unavailable: true }, { headers: { "Cache-Control": "no-store" } }); }
}
