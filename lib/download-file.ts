"use client";
export async function downloadFile(id: number, filename: string) {
 const chunks: Blob[] = [], limit = 3 * 1024 * 1024;
 let start = 0, total = Infinity;
 do {
  const response = await fetch("/api/files/" + id + "?action=download", { headers: { Range: "bytes=" + start + "-" + (start + limit - 1) } });
  if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");
  const blob = await response.blob();
  if (response.status === 200) { chunks.push(blob); break; }
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") || "");
  if (!match || Number(match[1]) !== start || Number(match[2]) - start + 1 !== blob.size) throw new Error("Download incompleto. Tente novamente.");
  total = Number(match[3]); chunks.push(blob); start += blob.size;
 } while (start < total);
 const url = URL.createObjectURL(new Blob(chunks)), link = document.createElement("a");
 link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
