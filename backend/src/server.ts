import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4173",
  }),
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ERCS backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/db-health", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS database_time, current_database() AS database_name",
    );

    res.status(200).json({
      success: true,
      message: "Neon PostgreSQL connection successful",
      database: result.rows[0].database_name,
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database connection test failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`ERCS API running at http://localhost:${PORT}`);
});