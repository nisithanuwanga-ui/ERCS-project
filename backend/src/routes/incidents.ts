import { Router, type Response } from "express";
import { pool } from "../db.js";

const severities = ["low", "medium", "high", "critical"] as const;
const statuses = [
  "reported",
  "investigating",
  "responding",
  "resolved",
  "closed",
] as const;

type IncidentField =
  | "title"
  | "description"
  | "incident_type"
  | "severity"
  | "status"
  | "location"
  | "latitude"
  | "longitude";

type IncidentInput = Partial<Record<IncidentField, string | number | null>>;

const textFields = {
  title: 200,
  description: Number.POSITIVE_INFINITY,
  incident_type: 50,
  location: Number.POSITIVE_INFINITY,
} as const;

const incidentFields: IncidentField[] = [
  "title",
  "description",
  "incident_type",
  "severity",
  "status",
  "location",
  "latitude",
  "longitude",
];

const router = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIncident(
  body: unknown,
  partial: boolean,
): { values?: IncidentInput; errors?: string[] } {
  if (!isRecord(body)) {
    return { errors: ["Request body must be a JSON object"] };
  }

  const errors: string[] = [];
  const values: IncidentInput = {};

  if (!partial) {
    for (const field of ["title", "description", "incident_type", "location"] as const) {
      if (!(field in body)) {
        errors.push(`${field} is required`);
      }
    }
  }

  for (const field of incidentFields) {
    if (!(field in body)) {
      continue;
    }

    const value = body[field];

    if (field in textFields) {
      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`${field} must be a non-empty string`);
      } else if (value.length > textFields[field as keyof typeof textFields]) {
        errors.push(`${field} exceeds its maximum length`);
      } else {
        values[field] = value.trim();
      }
      continue;
    }

    if (field === "severity") {
      if (typeof value !== "string" || !severities.includes(value as (typeof severities)[number])) {
        errors.push(`severity must be one of: ${severities.join(", ")}`);
      } else {
        values.severity = value;
      }
      continue;
    }

    if (field === "status") {
      if (typeof value !== "string" || !statuses.includes(value as (typeof statuses)[number])) {
        errors.push(`status must be one of: ${statuses.join(", ")}`);
      } else {
        values.status = value;
      }
      continue;
    }

    const max = field === "latitude" ? 90 : 180;
    const min = -max;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)) {
      errors.push(`${field} must be a number between ${min} and ${max}, or null`);
    } else {
      values[field] = value as number | null;
    }
  }

  if (errors.length > 0) {
    return { errors };
  }
  if (partial && Object.keys(values).length === 0) {
    return { errors: ["At least one incident field must be provided"] };
  }
  return { values };
}

function parseId(value: string | undefined): string | undefined {
  return value && /^[1-9]\d*$/.test(value) ? value : undefined;
}

function handleDatabaseError(error: unknown, res: Response): void {
  console.error("Incident database request failed:", error);
  res.status(500).json({ success: false, message: "Unable to process incident request" });
}

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, incident_type, severity, status, location,
              latitude, longitude, created_at, updated_at
       FROM incidents
       ORDER BY created_at DESC, id DESC`,
    );
    res.status(200).json({ success: true, incidents: result.rows });
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Incident ID must be a positive integer" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, title, description, incident_type, severity, status, location,
              latitude, longitude, created_at, updated_at
       FROM incidents WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: "Incident not found" });
      return;
    }
    res.status(200).json({ success: true, incident: result.rows[0] });
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

router.post("/", async (req, res) => {
  const parsed = parseIncident(req.body, false);
  if (parsed.errors) {
    res.status(400).json({ success: false, errors: parsed.errors });
    return;
  }

  const incident = parsed.values!;
  try {
    const result = await pool.query(
      `INSERT INTO incidents
         (title, description, incident_type, severity, status, location, latitude, longitude)
       VALUES ($1, $2, $3, COALESCE($4, 'medium'), COALESCE($5, 'reported'), $6, $7, $8)
       RETURNING id, title, description, incident_type, severity, status, location,
                 latitude, longitude, created_at, updated_at`,
      [
        incident.title,
        incident.description,
        incident.incident_type,
        incident.severity ?? null,
        incident.status ?? null,
        incident.location,
        incident.latitude ?? null,
        incident.longitude ?? null,
      ],
    );
    res.status(201).json({ success: true, incident: result.rows[0] });
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Incident ID must be a positive integer" });
    return;
  }

  const parsed = parseIncident(req.body, true);
  if (parsed.errors) {
    res.status(400).json({ success: false, errors: parsed.errors });
    return;
  }

  const entries = Object.entries(parsed.values!) as [IncidentField, string | number | null][];
  const assignments = entries.map(([field], index) => `${field} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  try {
    const result = await pool.query(
      `UPDATE incidents
       SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, incident_type, severity, status, location,
                 latitude, longitude, created_at, updated_at`,
      [id, ...values],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: "Incident not found" });
      return;
    }
    res.status(200).json({ success: true, incident: result.rows[0] });
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Incident ID must be a positive integer" });
    return;
  }

  try {
    const result = await pool.query("DELETE FROM incidents WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: "Incident not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

export { router as incidentsRouter };
