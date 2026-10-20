const fs = require("fs"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("child_process"),
  { makePdf } = require("./pdf-fixture.cjs");
require("@next/env").loadEnvConfig(process.cwd());
const url = process.argv[2],
  cli = require("./vercel-cli.cjs"),
  ids = [],
  temp = [];
function call(route, extra = [], json = true) {
  const r = spawnSync(
    process.execPath,
    [
      cli,
      "curl",
      route,
      "--deployment",
      url,
      "--",
      "--silent",
      "--show-error",
      "--fail-with-body",
      ...extra,
    ],
    {
      encoding: "utf8",
      timeout: 90000,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  if (r.status !== 0) throw Error("HTTP " + route + ": " + r.stdout);
  return json ? JSON.parse(r.stdout) : r.stdout;
}
function file(name, data) {
  const dest = ".vercel/recovery-" + name;
  fs.writeFileSync(dest, data);
  temp.push(dest);
  return dest;
}
function upload(name, bytes) {
  const result = call("/api/upload", ["--form", "file=@" + file(name, bytes)]);
  assert.equal(result.success, true);
  ids.push(result.uploadId);
  return result;
}
(async () => {
  const { Client } = require("pg"),
    db = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync("lib/supabase-ca.crt", "utf8"),
      },
    });
  await db.connect();
  try {
    const recovered = upload("damaged.pdf", makePdf({ damagedXref: true }));
    assert.equal(recovered.warnings.length, 0);
    let files = call(
      "/api/files/" + recovered.uploadId + "?action=upload-files",
    );
    assert.match(
      call("/api/files/" + files[0].id + "?action=content").content,
      /FILE EXTRACT/,
    );
    const broken = Buffer.from("%PDF-1.4\nbroken"),
      zip = new (require("adm-zip"))();
    zip.addFile("unreadable.pdf", broken);
    zip.addFile("note.txt", Buffer.from("texto preservado"));
    const result = upload("mixed.zip", zip.toBuffer());
    assert.equal(result.totalFiles, 2);
    assert.equal(result.warnings.length, 1);
    files = call("/api/files/" + result.uploadId + "?action=upload-files");
    const pdf = files.find((f) => f.filename === "unreadable.pdf"),
      note = files.find((f) => f.filename === "note.txt");
    assert.match(
      call("/api/files/" + note.id + "?action=content").content,
      /texto preservado/,
    );
    const content = call("/api/files/" + pdf.id + "?action=content");
    assert.equal(content.content, "");
    assert.ok(content.warning);
    assert.equal(JSON.parse(pdf.metadata).extraction_status, "error");
    const dest = ".vercel/recovery-download.pdf";
    temp.push(dest);
    call(
      "/api/files/" + pdf.id + "?action=download",
      ["--output", dest],
      false,
    );
    assert.deepEqual(fs.readFileSync(dest), broken);
    const direct = upload("unreadable.pdf", broken);
    assert.equal(direct.warnings.length, 1);
    console.log(
      "PASS Vercel: XRef recuperado, PDF ilegivel preservado, aviso na preview, ZIP parcial e download original integro",
    );
  } finally {
    for (const id of ids)
      await db.query("DELETE FROM public.uploads WHERE id=$1", [id]);
    await db.end();
    for (const name of temp) if (fs.existsSync(name)) fs.unlinkSync(name);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
