import "dotenv/config";
import { z } from "zod";
import { trustedOrigins } from "./origins.js";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z.url().default("http://127.0.0.1:5173"),
  TRUSTED_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
});
const environment = schema.parse(process.env);
export const config = {
  ...environment,
  ALLOWED_ORIGINS: trustedOrigins({
    nodeEnv: environment.NODE_ENV,
    appOrigin: environment.APP_ORIGIN,
    additionalOrigins: environment.TRUSTED_ORIGINS,
  }),
};
