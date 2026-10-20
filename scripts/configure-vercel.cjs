require("@next/env").loadEnvConfig(process.cwd());
const { spawnSync } = require("child_process");
const cli = require("./vercel-cli.cjs");
const configurations = [
  ["NEXT_PUBLIC_SUPABASE_URL", "production,preview,development", false],
  [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "production,preview,development",
    false,
  ],
  ["DATABASE_URL", "production,preview", true],
  ["DATABASE_URL", "development", false],
];
for (const [name, environments, secret] of configurations) {
  const value = process.env[name];
  if (!value) throw new Error("Variavel local ausente: " + name);
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "env",
      "add",
      name,
      "--environment",
      environments,
      "--force",
      "--yes",
      secret ? "--sensitive" : "--no-sensitive",
    ],
    { input: value, encoding: "utf8", timeout: 60000, windowsHide: true },
  );
  if (result.status !== 0) {
    let output =
      result.stderr ||
      result.stdout ||
      result.error?.message ||
      "Falha sem detalhe";
    output = output.split(value).join("[REDACTED]");
    console.error(name, output);
    process.exit(1);
  }
  console.log("Configurada:", name, "em", environments);
}
