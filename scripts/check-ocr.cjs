const fs = require("fs"),
  { spawnSync } = require("child_process"),
  { chromium } = require("@playwright/test"),
  assert = require("node:assert/strict");
require("@next/env").loadEnvConfig(process.cwd());
const url = process.argv[2],
  cli = require("./vercel-cli.cjs");
function request(route, extra = []) {
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
  return JSON.parse(r.stdout);
}
(async () => {
  let uploadId;
  const { Client } = require("pg"),
    db = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync("lib/supabase-ca.crt", "utf8"),
      },
    });
  await db.connect();
  let browser;
  try {
    await require("sharp")(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="180"><rect width="1000" height="180" fill="white"/><text x="35" y="110" font-family="Arial" font-size="48" font-weight="bold" fill="black">FILE EXTRACT TEST 12345</text></svg>',
      ),
    )
      .png()
      .toFile(".vercel/ocr-check.png");
    const zip = new (require("adm-zip"))();
    zip.addFile("ocr-check.png", fs.readFileSync(".vercel/ocr-check.png"));
    fs.writeFileSync(".vercel/ocr-check.zip", zip.toBuffer());
    const uploaded = request("/api/upload", [
      "--form",
      "file=@.vercel/ocr-check.zip",
    ]);
    uploadId = uploaded.uploadId;
    const files = request("/api/files/" + uploadId + "?action=upload-files");
    const result = request("/api/ocr", [
      "--request",
      "POST",
      "--header",
      "Content-Type:application/json",
      "--data",
      JSON.stringify({ fileId: files[0].id }),
    ]);
    assert.equal(result.success, true);
    assert.match(result.text, /EXTRACT/i);
    console.log(
      "PASS OCR real na Vercel: imagem processada e texto reconhecido",
    );
  } finally {
    if (browser) await browser.close();
    if (uploadId)
      await db.query("DELETE FROM public.uploads WHERE id=$1", [uploadId]);
    await db.end();
    for (const p of [".vercel/ocr-check.png", ".vercel/ocr-check.zip"])
      if (fs.existsSync(p)) fs.unlinkSync(p);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
