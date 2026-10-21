import type { PoolClient } from "pg";
import { getPool } from "./postgres";
export async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
 const client = await getPool().connect();
 try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
 catch(error) { await client.query("ROLLBACK"); throw error; }
 finally { client.release(); }
}
