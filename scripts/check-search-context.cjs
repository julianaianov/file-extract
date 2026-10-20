const fs = require("fs"), path = require("path"), assert = require("node:assert/strict"), ts = require("typescript"), Module = require("module");
require("@next/env").loadEnvConfig(process.cwd());
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) { return resolve.call(this, name.startsWith("@/") ? path.join(process.cwd(), name.slice(2)) : name, parent, ...rest); };
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { searchContext } = require("../lib/search-context.ts"), db = require("../lib/db.ts"), { getPool } = require("../lib/postgres.ts");
(async () => {
  let upload;
  try {
    const text = "antes 2\nantes 1\nAlVo encontrado\ndepois 1\ndepois 2\nfora";
    assert.deepEqual(searchContext(text, "alvo", "content")[0].lines.map(l => l.number), [1,2,3,4,5]);
    assert.equal(searchContext("alvo\nx\nalvo", "alvo", "content").length, 1);
    assert.equal(searchContext("x\nalvo", "ALVO", "content")[0].lines.length, 2);
    assert.equal(searchContext("100% literal\n100x", "%", "content")[0].lines.filter(l => l.match).length, 1);
    assert.equal(searchContext(null, "alvo", "content").length, 0);
    upload = await db.createUpload("search-test.zip", "search-test.zip", 1);
    const a = await db.createExtractedFile(upload, "conteudo.txt", "search-test/a", "text", 1, "text/plain", text);
    await db.createExtractedFile(upload, "alvo.txt", "search-test/b", "text", 1, "text/plain", "sem termo");
    const c = await db.createExtractedFile(upload, "audio.mp3", "search-test/c", "audio", 1, "audio/mpeg");
    await db.updateTranscription(c, text, "completed");
    const results = await db.searchFiles({ keyword: "alvo", uploadId: upload }, true);
    assert.equal(results.length, 3);
    assert.equal(results.find(f => f.id === a).search_context[0].lines.length, 5);
    assert.equal(results.find(f => f.filename === "alvo.txt").search_context.length, 0);
    assert.equal(results.find(f => f.id === c).search_context[0].source, "transcription");
    assert.ok(results.every(f => f.content_text === null));
    const plain = await db.searchFiles({ uploadId: upload }, true);
    assert.ok(plain.every(f => f.search_context === undefined));
    console.log("PASS: contexto de duas linhas, bordas, ocorrencias proximas, busca por nome/conteudo/transcricao no Supabase e resumo sem texto completo");
  } finally { if (upload) await db.deleteUpload(upload); await getPool().end(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
