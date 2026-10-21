"use client";
export async function uploadInParts(file: File, customName: string, progress: (value: number) => void) {
 const read = async (response: Response) => {
  const data = await response.json().catch(() => ({ error: "Falha na transferência. Tente novamente." }));
  if (!response.ok) { if ([401,402].includes(response.status)) window.dispatchEvent(new Event("billing-required")); throw new Error(data.error || "Falha no envio"); }
  return data;
 };
 const session = await read(await fetch("/api/upload/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size, customName }) }));
 try {
  for (let part = 0; part < session.count; part++) {
   const start = part * session.chunkSize, blob = file.slice(start, Math.min(file.size, start + session.chunkSize));
   let sent = false;
   for (let attempt = 0; attempt < 3 && !sent; attempt++) {
    try {
     const response = await fetch("/api/upload/sessions/" + session.id + "?part=" + part, { method: "PUT", body: blob });
     if (!response.ok && response.status < 500) await read(response);
     if (!response.ok) throw new Error("Falha temporária na transferência");
     await read(response); sent = true;
    } catch(e) { if (attempt === 2) throw e; }
   }
   progress(Math.round(Math.min(file.size, start + blob.size) / file.size * 100));
  }
  return await read(await fetch("/api/upload/sessions/" + session.id, { method: "POST" }));
 } catch(e) {
  await fetch("/api/upload/sessions/" + session.id, { method: "DELETE" }).catch(() => {});
  throw e;
 }
}
