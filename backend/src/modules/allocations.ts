import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { User } from "../../../shared/domain.js";
import { audit, history, transaction } from "../database.js";
import { HttpError, requireIncident } from "../security.js";
import { allocationSchema, releaseSchema } from "../validation.js";
async function idempotent(
  db: PoolClient,
  user: User,
  action: string,
  key: string,
  payload: unknown,
  work: () => Promise<unknown>,
) {
  if (!/^[\w-]{16,100}$/.test(key))
    throw new HttpError(400, "A valid Idempotency-Key header is required.");
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  await db.query(
    "INSERT INTO idempotency_keys(actor_id,action,key,digest) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [user.id, action, key, digest],
  );
  const row = (
    await db.query(
      "SELECT * FROM idempotency_keys WHERE actor_id=$1 AND action=$2 AND key=$3 FOR UPDATE",
      [user.id, action, key],
    )
  ).rows[0];
  if (row.digest !== digest)
    throw new HttpError(
      409,
      "This operation key was already used for different input.",
    );
  if (row.response) return row.response;
  const result = await work();
  await db.query(
    "UPDATE idempotency_keys SET response=$4 WHERE actor_id=$1 AND action=$2 AND key=$3",
    [user.id, action, key, JSON.stringify(result)],
  );
  return result;
}
export async function allocate(user: User, input: unknown, key: string) {
  const v = allocationSchema.parse(input);
  return transaction((db) =>
    idempotent(db, user, "allocate", key, v, async () => {
      const link = (
        await db.query(
          "SELECT incident_id FROM resource_requests WHERE id=$1",
          [v.request_id],
        )
      ).rows[0];
      if (!link) throw new HttpError(404, "Request not found.");
      const incident = await requireIncident(db, link.incident_id, user, true);
      if (["resolved", "closed"].includes(incident.status))
        throw new HttpError(
          409,
          "This incident no longer accepts allocations.",
        );
      const request = (
        await db.query(
          "SELECT * FROM resource_requests WHERE id=$1 FOR UPDATE",
          [v.request_id],
        )
      ).rows[0];
      const resource = (
        await db.query("SELECT * FROM resources WHERE id=$1 FOR UPDATE", [
          v.resource_id,
        ])
      ).rows[0];
      if (!resource) throw new HttpError(404, "Resource not found.");
      if (!["approved", "partially_fulfilled"].includes(request.status))
        throw new HttpError(
          409,
          "Only approved outstanding requests can be allocated.",
        );
      if (resource.status !== "operational")
        throw new HttpError(409, "This resource is not operational.");
      if (
        request.resource_id
          ? request.resource_id !== resource.id
          : request.category_id !== resource.category_id
      )
        throw new HttpError(400, "Resource does not match this request.");
      if (v.quantity > request.quantity - request.issued_quantity)
        throw new HttpError(
          409,
          "Quantity exceeds the approved outstanding demand.",
        );
      if (v.quantity > resource.available_quantity)
        throw new HttpError(409, "Insufficient resource availability.");
      const allocation = (
        await db.query(
          "INSERT INTO allocations(request_id,resource_id,quantity,responsible_id) VALUES($1,$2,$3,$4) RETURNING *",
          [v.request_id, v.resource_id, v.quantity, user.id],
        )
      ).rows[0];
      await db.query(
        "UPDATE resources SET allocated_quantity=allocated_quantity+$1,updated_at=now() WHERE id=$2",
        [v.quantity, v.resource_id],
      );
      const next =
        request.issued_quantity + v.quantity === request.quantity
          ? "completed"
          : "partially_fulfilled";
      await db.query(
        "UPDATE resource_requests SET issued_quantity=issued_quantity+$1,status=$2,updated_at=now() WHERE id=$3",
        [v.quantity, next, v.request_id],
      );
      await db.query(
        "INSERT INTO inventory_movements(resource_id,allocation_id,quantity_delta,action,actor_id) VALUES($1,$2,$3,'allocated',$4)",
        [v.resource_id, allocation.id, -v.quantity, user.id],
      );
      await history(
        db,
        user.id,
        "resource-requests",
        request.id,
        request.status,
        next,
      );
      await audit(
        db,
        user.id,
        "allocation.created",
        "allocations",
        allocation.id,
        { quantity: v.quantity },
      );
      return allocation;
    }),
  );
}
export async function release(
  user: User,
  id: string,
  input: unknown,
  key: string,
) {
  const v = releaseSchema.parse(input);
  return transaction((db) =>
    idempotent(db, user, `release:${id}`, key, v, async () => {
      const link = (
        await db.query(
          "SELECT a.*,r.incident_id FROM allocations a JOIN resource_requests r ON r.id=a.request_id WHERE a.id=$1",
          [id],
        )
      ).rows[0];
      if (!link) throw new HttpError(404, "Allocation not found.");
      await requireIncident(db, link.incident_id, user, true);
      await db.query(
        "SELECT id FROM resource_requests WHERE id=$1 FOR UPDATE",
        [link.request_id],
      );
      await db.query("SELECT id FROM resources WHERE id=$1 FOR UPDATE", [
        link.resource_id,
      ]);
      const allocation = (
        await db.query("SELECT * FROM allocations WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (v.quantity > allocation.quantity - allocation.released_quantity)
        throw new HttpError(
          409,
          "Return quantity exceeds outstanding allocation.",
        );
      await db.query(
        "UPDATE resources SET allocated_quantity=allocated_quantity-$1,updated_at=now() WHERE id=$2",
        [v.quantity, allocation.resource_id],
      );
      const result = (
        await db.query(
          "UPDATE allocations SET released_quantity=released_quantity+$1,updated_at=now() WHERE id=$2 RETURNING *",
          [v.quantity, id],
        )
      ).rows[0];
      await db.query(
        "INSERT INTO allocation_releases(allocation_id,quantity,reason,actor_id) VALUES($1,$2,$3,$4)",
        [id, v.quantity, v.reason, user.id],
      );
      await db.query(
        "INSERT INTO inventory_movements(resource_id,allocation_id,quantity_delta,action,actor_id) VALUES($1,$2,$3,'returned',$4)",
        [allocation.resource_id, id, v.quantity, user.id],
      );
      await audit(db, user.id, "allocation.released", "allocations", id, {
        quantity: v.quantity,
        reason: v.reason,
      });
      return result;
    }),
  );
}
