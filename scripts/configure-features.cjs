const { spawnSync } = require("child_process");
const cli = require("./vercel-cli.cjs");
const settings = [
  ["OCR_LANG", "por+eng", "production,preview,development"],
  ["TESSERACT_CACHE_PATH", "/tmp/tesseract-cache", "production,preview"],
  [
    "TESSERACT_LANG_PATH",
    "https://tessdata.projectnaptha.com/4.0.0",
    "production,preview",
  ],
];
for (const [name, value, environment] of settings) {
  const r = spawnSync(
    process.execPath,
    [
      cli,
      "env",
      "add",
      name,
      "--environment",
      environment,
      "--force",
      "--yes",
      "--no-sensitive",
    ],
    { input: value, encoding: "utf8", timeout: 60000, windowsHide: true },
  );
  if (r.status !== 0) {
    console.error("Falha ao configurar " + name);
    process.exit(1);
  }
  console.log("Configurada: " + name + " (" + environment + ")");
}
