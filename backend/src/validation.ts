import { z } from "zod";
import { priorities, roles } from "../../shared/domain.js";
export const idSchema = z.uuid();
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");
const text = z.string().trim().min(2).max(160);
const description = z.string().trim().min(5).max(5000);
export const incidentSchema = z
  .object({
    title: text,
    category_id: idSchema,
    description,
    severity: z.enum(priorities),
    priority: z.enum(priorities),
    location: text,
  })
  .strict();
export const incidentPatch = incidentSchema
  .partial()
  .extend({
    status: z
      .enum(["reported", "active", "controlled", "resolved", "closed"])
      .optional(),
  })
  .strict();
export const resourceSchema = z
  .object({
    name: text,
    category_id: idSchema,
    description: z.string().max(5000).default(""),
    kind: z.enum(["stock", "asset"]),
    total_quantity: z.number().int().min(0).max(100000000),
    status: z.enum(["operational", "maintenance", "unavailable"]),
    location: text,
    threshold: z.number().int().min(0).max(100000000),
  })
  .strict()
  .refine(
    (v) => v.kind !== "asset" || v.total_quantity === 1,
    "An indivisible asset must have total quantity 1.",
  );
export const requestSchema = z
  .object({
    incident_id: idSchema,
    resource_id: idSchema.nullable().optional(),
    category_id: idSchema.nullable().optional(),
    quantity: z.number().int().positive().max(100000000),
    priority: z.enum(priorities),
    justification: description,
  })
  .strict()
  .refine(
    (v) => Boolean(v.resource_id) !== Boolean(v.category_id),
    "Select either a resource or a category.",
  );
export const allocationSchema = z
  .object({
    request_id: idSchema,
    resource_id: idSchema,
    quantity: z.number().int().positive().max(100000000),
  })
  .strict();
export const releaseSchema = z
  .object({
    quantity: z.number().int().positive().max(100000000),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export const stockAdjustmentSchema = z
  .object({
    quantity_delta: z
      .number()
      .int()
      .min(-100000000)
      .max(100000000)
      .refine((v) => v !== 0, "Enter a nonzero quantity adjustment."),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export const teamSchema = z
  .object({
    name: text,
    type_id: idSchema,
    lead_id: idSchema,
    contact: z.string().max(200).default(""),
    status: z.enum(["operational", "unavailable"]),
    member_ids: z.array(idSchema).max(100).default([]),
  })
  .strict();
export const invitationSchema = z
  .object({
    email: z.email().transform((x) => x.toLowerCase()),
    role: z.enum(roles),
  })
  .strict();
