const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict"),
  ts = require("typescript"),
  Module = require("module");
require("@next/env").loadEnvConfig(process.cwd());
const previousResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith("@/")) name = path.join(process.cwd(), name.slice(2));
  return previousResolve.call(this, name, parent, ...rest);
};
require.extensions[".ts"] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const { POST } = require("../app/api/upload/route.ts"),
  { GET } = require("../app/api/files/[id]/route.ts");
const db = require("../lib/db.ts"),
  { getPool } = require("../lib/postgres.ts"),
  ids = [];
(async () => {
  try {
    const pdf = require("./pdf-fixture.cjs").makePdf(),
      zip = new (require("adm-zip"))();
    zip.addFile("document.pdf", pdf);
    zip.addFile("note.txt", Buffer.from("verificacao supabase"));
    for (const [name, bytes] of [
      ["verification.pdf", pdf],
      ["verification.zip", zip.toBuffer()],
    ]) {
      const form = new FormData();
      form.append("file", new File([bytes], name));
      const response = await POST(
          new Request("http://localhost/api/upload", {
            method: "POST",
            body: form,
          }),
        ),
        result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      ids.push(result.uploadId);
      const files = await db.getExtractedFilesByUpload(result.uploadId);
      assert.equal(files.length, result.totalFiles);
      const document = files.find((f) => f.mime_type === "application/pdf");
      assert.ok(document.content_text.trim().length > 0);
      const download = await GET(
        new Request(
          "http://localhost/api/files/" + document.id + "?action=download",
        ),
        { params: Promise.resolve({ id: String(document.id) }) },
      );
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
      const preview = await GET(
        new Request(
          "http://localhost/api/files/" + document.id + "?action=content",
        ),
        { params: Promise.resolve({ id: String(document.id) }) },
      );
      assert.equal((await preview.json()).type, "text");
    }
    console.log(
      "PASS Supabase real: PDF e ZIP enviados, texto salvo, preview e download conferidos",
    );
  } finally {
    for (const id of ids) await db.deleteUpload(id);
    await getPool().end();
    Module._resolveFilename = previousResolve;
  }
})().catch((e) => {
  console.error("Falha no teste:", e.code || e.name, e.message);
  process.exitCode = 1;
});
