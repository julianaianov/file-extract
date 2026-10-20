const fs = require("fs"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("child_process");
require("@next/env").loadEnvConfig(process.cwd());
const deployment = process.argv[2];
if (!deployment) throw Error("Informe a URL da implantacao");
const cli = require("./vercel-cli.cjs"),
  ids = [];
function request(route, extra = []) {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "curl",
      route,
      "--deployment",
      deployment,
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
      maxBuffer: 5 * 1024 * 1024,
    },
  );
  if (result.status !== 0)
    throw Error("Falha HTTP em " + route + ": " + result.stdout);
  return JSON.parse(result.stdout);
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
    assert.equal(request("/api/debug").connected, true);
    const zip = new (require("adm-zip"))();
    zip.addFile("test.txt", Buffer.from("verificacao Vercel ZIP"));
    fs.writeFileSync(".vercel/check.zip", zip.toBuffer());
    fs.writeFileSync(
      ".vercel/check.pdf",
      require("./pdf-fixture.cjs").makePdf(),
    );
    for (const file of [".vercel/check.pdf", ".vercel/check.zip"]) {
      const result = request("/api/upload", ["--form", "file=@" + file]);
      assert.equal(result.success, true);
      ids.push(result.uploadId);
      const files = request(
        "/api/files/" + result.uploadId + "?action=upload-files",
      );
      assert.equal(files.length, 1);
      const content = request("/api/files/" + files[0].id + "?action=content");
      assert.equal(content.type, "text");
      assert.ok(content.content.trim().length > 0);
    }
    console.log(
      "PASS Vercel: Supabase conectado, uploads PDF/ZIP e visualizacao funcionando",
    );
  } finally {
    for (const id of ids)
      await db.query("DELETE FROM public.uploads WHERE id=$1", [id]);
    await db.end();
    if (fs.existsSync(".vercel/check.pdf")) fs.unlinkSync(".vercel/check.pdf");
    if (fs.existsSync(".vercel/check.zip")) fs.unlinkSync(".vercel/check.zip");
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
