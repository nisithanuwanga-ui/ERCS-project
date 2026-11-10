import type { Pool, PoolClient } from "pg";
import { HttpError } from "../security.js";
export async function activeReference(
  db: Pool | PoolClient,
  id: string,
  kind: string,
) {
  if (
    !(
      await db.query(
        "SELECT id FROM reference_data WHERE id=$1 AND kind=$2 AND active",
        [id, kind],
      )
    ).rowCount
  )
    throw new HttpError(400, "Select an active reference value.");
}
