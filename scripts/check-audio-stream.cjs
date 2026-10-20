
const fs = require("fs"), path = require("path"), assert = require("node:assert/strict"), ts = require("typescript"), Module = require("module");
require("@next/env").loadEnvConfig(process.cwd());
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) { return resolve.call(this, name.startsWith("@/") ? path.join(process.cwd(), name.slice(2)) : name, parent, ...rest); };
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const db = require("../lib/db.ts"), { saveStoredFile } = require("../lib/storage.ts"), { GET } = require("../app/api/files/[id]/route.ts"), { getPool } = require("../lib/postgres.ts");
(async () => {
 let upload;
 try {
  upload = await db.createUpload("audio-test.zip", "audio-test.zip", 100);
  const data = Buffer.from("0123456789");
  const key = "test-audio/" + upload;
  await saveStoredFile(key, upload, data);
  const id = await db.createExtractedFile(upload, "audio.wav", key, "audio", data.length, "audio/wav");
  const get = range => GET(new Request("http://localhost/api/files/" + id + "?action=stream", { headers: range ? { range } : {} }), { params: Promise.resolve({ id: String(id) }) });
  let r = await get(); assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), data);
  for (const [range, expected] of [["bytes=2-5", "2345"], ["bytes=6-", "6789"], ["bytes=-3", "789"]]) {
   r = await get(range); assert.equal(r.status, 206); assert.equal(await r.text(), expected);
  }
  for (const range of ["bytes=20-", "bytes=5-2", "bytes=-0", "bytes=a-b"]) { r = await get(range); assert.equal(r.status, 416); assert.equal(r.headers.get("Content-Range"), "bytes */10"); }
  console.log("PASS Supabase: audio original, leitura parcial, avanco, sufixo e intervalos invalidos");
 } finally { if (upload) await db.deleteUpload(upload); await getPool().end(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
