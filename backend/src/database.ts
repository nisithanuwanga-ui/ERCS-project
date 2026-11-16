import pg from "pg";
import type { PoolClient } from "pg";
import { config } from "./config.js";
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 15,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
pool.on("error", (error) =>
  console.error(
    JSON.stringify({
      event: "database_pool_error",
      code: (error as NodeJS.ErrnoException).code,
    }),
  ),
);
export async function transaction<T>(
  work: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function audit(
  db: PoolClient,
  actor: string | null,
  action: string,
  entity: string,
  id: string | null,
  metadata: object = {},
) {
  await db.query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)",
    [actor, action, entity, id, JSON.stringify(metadata)],
  );
}
export async function history(
  db: PoolClient,
  actor: string,
  entity: string,
  id: string,
  from: string | null,
  to: string | null,
  note = "",
  action = from ? "status_changed" : to ? "created" : "note_added",
) {
  await db.query(
    "INSERT INTO history(actor_id,entity_type,entity_id,action,previous_status,next_status,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [actor, entity, id, action, from, to, note],
  );
}
