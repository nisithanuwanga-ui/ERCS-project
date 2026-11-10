import { Router } from "express";
import { permit, userOf } from "../security.js";
import { idSchema } from "../validation.js";
import { allocate, release } from "./allocations.js";

export const router = Router();
router.post("/allocations", permit("allocations.manage"), async (req, res) =>
  res.status(201).json({
    data: await allocate(
      userOf(req),
      req.body,
      req.get("Idempotency-Key") ?? "",
    ),
  }),
);
router.post(
  "/allocations/:id/releases",
  permit("allocations.manage"),
  async (req, res) =>
    res.json({
      data: await release(
        userOf(req),
        idSchema.parse(req.params.id),
        req.body,
        req.get("Idempotency-Key") ?? "",
      ),
    }),
);
