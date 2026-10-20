import { Pool, types } from "pg";
types.setTypeParser(20, Number);
import { supabaseCa } from "./supabase-ca";
let pool: Pool | undefined;
export function getPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL do Supabase não configurada no servidor");
  return (pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 1000,
    maxLifetimeSeconds: 60,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: true, ca: supabaseCa },
  }));
}
export async function query(sql: string, params: unknown[] = []) {
  return getPool().query(sql, params);
}
