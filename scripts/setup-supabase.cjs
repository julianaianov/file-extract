const fs = require("fs");
require("@next/env").loadEnvConfig(process.cwd());
const { Client } = require("pg");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("lib/supabase-ca.crt", "utf8"),
  },
});
(async () => {
  try {
    await client.connect();
    await client.query(fs.readFileSync("scripts/002-supabase.sql", "utf8"));
    await client.query(fs.readFileSync("scripts/003-accounts-billing.sql", "utf8"));
    const result = await client.query(
      "SELECT COUNT(*)::int AS total FROM public.uploads",
    );
    console.log(
      "Supabase conectado; schema pronto; uploads:",
      result.rows[0].total,
    );
  } catch (e) {
    console.error(
      "Falha Supabase:",
      e.code || e.name,
      e.message.replace(/postgresql:\/\/[^\s]+/g, "[redacted]"),
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
