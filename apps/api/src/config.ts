import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().trim().min(1),
  CORS_ORIGIN: z.string().trim().min(1).default("http://localhost:5173"),
  APP_VERSION: z.string().trim().min(1).default("0.1.0"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(5).default(30),
  FIREBASE_PROJECT_ID: z.string().trim().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().trim().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().trim().min(1).optional(),
});

export const env = envSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
