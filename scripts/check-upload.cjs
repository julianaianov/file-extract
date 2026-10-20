const fs = require("fs"),
  assert = require("node:assert/strict"),
  ts = require("typescript"),
  Module = require("module"),
  AdmZip = require("adm-zip"),
  { makePdf } = require("./pdf-fixture.cjs");
const records = [],
  stored = [],
  metadata = new Map();
let deleted = 0,
  failStorage = false;
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
const db = {
  createUpload: async () => 1,
  createExtractedFile: async (...args) => {
    records.push(args);
    return records.length;
  },
  updateFileMetadata: async (id, value) => metadata.set(id, value),
  updateUploadStatus: async () => {},
  deleteUpload: async () => {
    deleted++;
  },
};
const original = Module._load;
Module._load = function (name, ...args) {
  if (name === "@/lib/db") return db;
  if (name === "@/lib/storage")
    return {
      saveStoredFile: async (...args) => {
        if (failStorage) throw Error("storage failure");
        stored.push(args);
      },
    };
  if (name === "@/lib/pdf") return require("../lib/pdf.ts");
  return original.call(this, name, ...args);
};
const m = new Module(
  require("path").resolve("app/api/upload/route.ts"),
  module,
);
m.paths = module.paths;
m.filename = require("path").resolve("app/api/upload/route.ts");
m._compile(
  ts.transpileModule(fs.readFileSync(m.filename, "utf8"), {
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
  const pdf = makePdf();
  let r = await upload("document.PDF", pdf);
  assert.equal(r.status, 200);
  assert.match(records.at(-1)[6], /FILE EXTRACT/);
  assert.deepEqual(stored.at(-1)[2], pdf);
  r = await upload("damaged.pdf", makePdf({ damagedXref: true }));
  assert.equal(r.status, 200);
  assert.match(records.at(-1)[6], /FILE EXTRACT/);
  r = await upload("unreadable.pdf", Buffer.from("%PDF-1.4\nbroken"));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).warnings.length, 1);
  assert.equal(records.at(-1)[6], null);
  assert.equal(metadata.get(records.length).extraction_status, "error");
  const zip = new AdmZip();
  zip.addFile("a/document.pdf", pdf);
  zip.addFile("b/document.pdf", pdf);
  zip.addFile("broken.pdf", Buffer.from("%PDF-1.4\nbroken"));
  zip.addFile("note.txt", Buffer.from("teste\0 texto"));
  r = await upload("archive.ZIP", zip.toBuffer());
  assert.equal(r.status, 200);
  const result = await r.json();
  assert.equal(result.totalFiles, 4);
  assert.equal(result.warnings.length, 1);
  assert.equal(records.find((x) => x[1] === "note.txt")[6], "teste texto");
  assert.equal(new Set(stored.map((x) => x[0])).size, stored.length);
  r = await upload("invalid.pdf", Buffer.from("not a pdf"));
  assert.equal(r.status, 422);
  r = await upload("invalid.zip", Buffer.from("not a zip"));
  assert.equal(r.status, 422);
  r = await upload("bad.exe", Buffer.from("x"));
  assert.equal(r.status, 400);
  failStorage = true;
  r = await upload("storage.pdf", pdf);
  assert.equal(r.status, 500);
  assert.equal(deleted, 1);
  console.log(
    "PASS: PDF normal, reparo de XRef, preservacao de PDF ilegivel, ZIP parcial sem perda, bytes originais, texto sem NUL, validacao e falha real de armazenamento",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
