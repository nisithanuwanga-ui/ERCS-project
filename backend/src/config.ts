import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z.url().default("http://127.0.0.1:5173"),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
});
export const config = schema.parse(process.env);
