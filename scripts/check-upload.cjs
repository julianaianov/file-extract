const fs = require("fs"),
  assert = require("node:assert/strict"),
  ts = require("typescript"),
  Module = require("module"),
  AdmZip = require("adm-zip");
const records = [],
  stored = [];
let deleted = 0;
const db = {
  createUpload: async () => 1,
  createExtractedFile: async (...args) => {
    records.push(args);
    return records.length;
  },
  updateUploadStatus: async () => {},
  deleteUpload: async () => {
    deleted++;
  },
};
const original = Module._load;
Module._load = function (name, ...args) {
  if (name === "@/lib/db") return db;
  if (name === "@/lib/storage")
    return { saveStoredFile: async (...args) => stored.push(args) };
  return original.call(this, name, ...args);
};
const m = new Module(
  require("path").resolve("app/api/upload/route.ts"),
  module,
);
m.paths = module.paths;
m.filename = require("path").resolve("app/api/upload/route.ts");
m._compile(
  ts.transpileModule(fs.readFileSync("app/api/upload/route.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
  m.filename,
);
Module._load = original;
async function upload(name, bytes) {
  const form = new FormData();
  form.append("file", new File([bytes], name));
  return m.exports.POST(
    new Request("http://localhost/api/upload", { method: "POST", body: form }),
  );
}
(async () => {
  const pdf = fs.readFileSync("node_modules/pdf-parse/test/data/01-valid.pdf");
  let r = await upload("document.PDF", pdf);
  assert.equal(r.status, 200);
  assert.equal(records.at(-1)[5], "application/pdf");
  assert.ok(records.at(-1)[6].trim().length > 0);
  const zip = new AdmZip();
  zip.addFile("folder/document.pdf", pdf);
  zip.addFile("other/document.pdf", pdf);
  zip.addFile("note.txt", Buffer.from("teste texto"));
  r = await upload("archive.ZIP", zip.toBuffer());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).totalFiles, 3);
  assert.equal(new Set(stored.map((x) => x[0])).size, stored.length);
  assert.equal(records.find((x) => x[1] === "note.txt")[6], "teste texto");
  r = await upload("bad.exe", Buffer.from("x"));
  assert.equal(r.status, 400);
  r = await upload("invalid.pdf", Buffer.from("invalid pdf"));
  assert.equal(r.status, 500);
  assert.equal(deleted, 1);
  r = await upload("invalid.zip", Buffer.from("invalid zip"));
  assert.equal(r.status, 500);
  console.log(
    "PASS: PDF direto, PDF em ZIP, nomes repetidos, texto, extensao invalida, PDF/ZIP invalidos e limpeza apos falha",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
